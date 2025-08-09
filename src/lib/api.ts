export const getLiveDataUrl = () =>
  `/live.json?v=${Math.floor(Date.now() / 60000)}`;
export const getHistoricalDataUrl = (damName: string) =>
  `/historic_data/${damName.replace(/\s+/g, '_')}.json`;

export const fetchLiveDamData = async () => {
  try {
    const response = await fetch(getLiveDataUrl());
    if (!response.ok) {
      throw new Error('Failed to fetch live data');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching live data:', error);
    throw error;
  }
};

export const fetchHistoricalDamData = async (damName: string) => {
  try {
    const response = await fetch(getHistoricalDataUrl(damName));
    if (!response.ok) {
      throw new Error(`Failed to fetch data for dam: ${damName}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching data for dam ${damName}:`, error);
    throw error;
  }
};
