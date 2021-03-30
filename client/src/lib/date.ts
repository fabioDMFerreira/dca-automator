export const formatDate = (date: Date | string): string => {
  if (!date) {
    return "";
  }

  if (typeof date === "string") {
    date = new Date(date);
  }

  if (date.getTime() < 0) {
    return "";
  }

  return `${date.getFullYear()}-${getMonthFormatted(date)}-${formatDatePart(date.getDate())} ${formatDatePart(date.getHours())}:${formatDatePart(date.getMinutes())}`;
};

function getMonthFormatted(date: Date) {
  var month = date.getMonth() + 1;
  return month < 10 ? '0' + month : '' + month;
}

function formatDatePart(part: number) {
  return part < 10 ? '0' + part : part;
}
