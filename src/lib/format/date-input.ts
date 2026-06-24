// Pure conversion helpers for the DateField input. The stored/submitted value is
// ISO `yyyy-mm-dd` (like a native date input); the user sees & types `dd/mm/yyyy`.

/** ISO `yyyy-mm-dd` → display `dd/mm/yyyy` (empty string if not a full ISO date). */
export function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Display `dd/mm/yyyy` → ISO `yyyy-mm-dd` (empty string if incomplete/invalid). */
export function displayToIso(s: string): string {
  const m = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/.exec(s.trim());
  if (!m) return "";
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
  return `${m[3]}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
