export function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateString);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function calculateWeekFromSurgeryDate(surgeryDate, logDate) {
  if (!surgeryDate || !logDate) return "";
  const surgery = new Date(`${surgeryDate}T00:00:00`);
  const logged = new Date(`${logDate}T00:00:00`);
  const diffMs = logged.getTime() - surgery.getTime();
  if (Number.isNaN(diffMs)) return "";
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 0) return "";
  return String(Math.floor(diffDays / 7) + 1);
}

export function calculateDaysSinceSurgery(surgeryDate) {
  if (!surgeryDate) return null;
  const surgery = new Date(`${surgeryDate}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = today.getTime() - surgery.getTime();
  if (Number.isNaN(diffMs)) return null;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 0) return null;
  return diffDays + 1;
}
