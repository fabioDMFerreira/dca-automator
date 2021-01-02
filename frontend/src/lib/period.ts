export const periods = [{
  label: "Every minute",
  value: 60
},{
  label: "Hourly",
  value: 3600
}, {
  label: "Daily",
  value: 86400
}, {
  label: "Weekly",
  value: 604800
}, {
  label: "Monthly",
  value: 2419200
}]

export const formatPeriod = (period: number) => {
  const periodItem = periods.find(p => p.value == period)

  if(periodItem){
    return periodItem.label
  }

  return period
}
