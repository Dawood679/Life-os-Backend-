// Validates the "YYYY-MM-DD" date string the client sends.
// We never derive "today" with new Date() on the server — timezone bugs.
const isValidDateString = (dateStr) => {
  if (typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime());
};

module.exports = { isValidDateString };