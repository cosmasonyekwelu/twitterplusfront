// src/components/ProfileEditModal.jsx
import { useState } from "react";
import API from "../services/api";

export default function ProfileEditModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    bio: initial?.bio || "",
    location: initial?.location || "",
    website: initial?.website || "",
    dob: initial?.dob || "",
    currentPassword: "",
    newPassword: "",
  });
  const [avatar, setAvatar] = useState(null);
  const [cover, setCover] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.currentPassword.trim()) {
      setErr("Current password is required");
      return;
    }
    try {
      setBusy(true);
      const fd = new FormData();
      if (form.name) fd.append("name", form.name);
      if (form.bio) fd.append("bio", form.bio);
      if (form.location) fd.append("location", form.location);
      if (form.website) fd.append("website", form.website);
      if (form.dob) fd.append("dob", form.dob);
      if (form.currentPassword) fd.append("currentPassword", form.currentPassword);
      if (form.newPassword) fd.append("newPassword", form.newPassword);
      if (avatar) fd.append("avatar", avatar);
      if (cover) fd.append("coverPhoto", cover);

      await API.put("/profile", fd); // PUT /api/profile (multer fields: avatar, coverPhoto)
      onSaved?.();
    } catch (e2) {
      console.error("profile save", e2);
      const msg = e2?.response?.data?.message || "Failed to update profile";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-black border border-gray-800 rounded-2xl w-full max-w-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="font-bold text-lg">Edit profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-3">
          {err && <div className="text-red-400">{err}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm">
              <div className="text-gray-400 mb-1">Name</div>
              <input name="name" value={form.name} onChange={onChange} className="w-full bg-black border border-gray-800 rounded-lg p-2" />
            </label>
            <label className="text-sm">
              <div className="text-gray-400 mb-1">Website</div>
              <input name="website" value={form.website} onChange={onChange} className="w-full bg-black border border-gray-800 rounded-lg p-2" />
            </label>
            <label className="text-sm md:col-span-2">
              <div className="text-gray-400 mb-1">Bio</div>
              <textarea name="bio" value={form.bio} onChange={onChange} rows={3} className="w-full bg-black border border-gray-800 rounded-lg p-2" />
            </label>
            <label className="text-sm">
              <div className="text-gray-400 mb-1">Location</div>
              <input name="location" value={form.location} onChange={onChange} className="w-full bg-black border border-gray-800 rounded-lg p-2" />
            </label>
            <label className="text-sm">
              <div className="text-gray-400 mb-1">Date of birth</div>
              <input type="date" name="dob" value={form.dob} onChange={onChange} className="w-full bg-black border border-gray-800 rounded-lg p-2" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <label className="text-sm">
              <div className="text-gray-400 mb-1">Avatar</div>
              <input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] || null)} />
            </label>
            <label className="text-sm">
              <div className="text-gray-400 mb-1">Cover photo</div>
              <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <label className="text-sm">
              <div className="text-gray-400 mb-1">Current password *</div>
              <input type="password" name="currentPassword" value={form.currentPassword} onChange={onChange} required className="w-full bg-black border border-gray-800 rounded-lg p-2" />
            </label>
            <label className="text-sm">
              <div className="text-gray-400 mb-1">New password (optional)</div>
              <input type="password" name="newPassword" value={form.newPassword} onChange={onChange} className="w-full bg-black border border-gray-800 rounded-lg p-2" />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-full border border-gray-700 hover:bg-gray-900">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-full bg-white text-black font-bold hover:bg-gray-200 disabled:opacity-60">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
