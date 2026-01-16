const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export const getPrefillableCount = ({ reportItems, previousItems, positions }) => {
  let count = 0;
  for (const position of positions) {
    if (reportItems[position.id]) continue;
    if (!hasOwn(previousItems, position.id)) continue;
    count += 1;
  }
  return count;
};

export const applyPrefillFromYesterday = ({
  reportItems,
  previousItems,
  previousDayData,
  positions,
}) => {
  const nextItems = { ...reportItems };

  for (const position of positions) {
    if (nextItems[position.id]) continue;
    if (!hasOwn(previousItems, position.id)) continue;

    const endingStock = previousItems[position.id];
    const prevData = previousDayData[position.id];
    const writeOff = prevData
      ? Math.max(0, prevData.ending_stock + prevData.arrivals - endingStock)
      : 0;

    nextItems[position.id] = {
      position_id: position.id,
      ending_stock: endingStock,
      write_off: writeOff,
    };
  }

  return nextItems;
};
