exports.generateICS = (appointment) => {
  const startTimeResult = appointment.startTime.replace(":", "") + "00";
  const endTimeResult = appointment.endTime.replace(":", "") + "00";
  const dateResult = appointment.date.split("-").join("");

  // ISO format for ICS: YYYYMMDDTHHMMSS
  // Assuming local time or whatever timezone strategy (simplified here)
  const dtStart = `${dateResult}T${startTimeResult}`;
  const dtEnd = `${dateResult}T${endTimeResult}`;

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MediConnect//Appointment//EN
BEGIN:VEVENT
UID:${appointment._id}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:Appointment with Doctor
DESCRIPTION:Reason: ${appointment.reason || "Medical Checkup"}
LOCATION:MediConnect Clinic
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
};
