import API from "./api";

// Normal (non-streaming) call
export async function grokAsk({ prompt, model = "gemini-1.5-flash", system, temperature = 0.7 }) {
  const res = await API.post("/grok/ask", { prompt, model, system, temperature, stream: false });
  return res.data?.text || "";
}

// Streaming via SSE
export function grokAskStream({ prompt, model = "gemini-1.5-flash", system, temperature = 0.7 }, onDelta, onDone, onError) {
  // Use fetch so we can read the event stream directly
  const url = `${API.defaults.baseURL.replace(/\/+$/, "")}/grok/ask`;
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: (API.defaults.headers.common?.Authorization || ""),
        },
        body: JSON.stringify({ prompt, model, system, temperature, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Failed to stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Process SSE frames
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          if (!part.startsWith("data:")) continue;
          const json = part.replace(/^data:\s*/, "");
          if (!json) continue;
          try {
            const payload = JSON.parse(json);
            if (payload.delta) onDelta?.(payload.delta);
            if (payload.done) onDone?.();
            if (payload.error) onError?.(new Error(payload.error));
          } catch {}
        }
      }
      onDone?.();
    } catch (e) {
      onError?.(e);
    }
  })();

  return () => controller.abort();
}
