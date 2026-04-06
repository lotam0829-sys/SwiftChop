// Common Nigerian banks with their Paystack bank codes
export interface NigerianBank {
  name: string;
  code: string;
}

export const nigerianBanks: NigerianBank[] = [
  { name: 'Test Bank (Paystack)', code: '001' },
  { name: 'Access Bank', code: '044' },
  { name: 'Citibank Nigeria', code: '023' },
  { name: 'Diamond Bank', code: '063' },
  { name: 'Ecobank Nigeria', code: '050' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'First City Monument Bank', code: '214' },
  { name: 'Globus Bank', code: '00103' },
  { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'Heritage Bank', code: '030' },
  { name: 'Jaiz Bank', code: '301' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Kuda Bank', code: '50211' },
  { name: 'Lotus Bank', code: '303' },
  { name: 'Moniepoint MFB', code: '50515' },
  { name: 'OPay', code: '999992' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Parallex Bank', code: '104' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Providus Bank', code: '101' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Standard Chartered Bank', code: '068' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'SunTrust Bank', code: '100' },
  { name: 'TAJ Bank', code: '302' },
  { name: 'Titan Trust Bank', code: '102' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'United Bank for Africa', code: '033' },
  { name: 'Unity Bank', code: '215' },
  { name: 'VFD Microfinance Bank', code: '566' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Zenith Bank', code: '057' },
];

export function getBankByName(name: string): NigerianBank | undefined {
  const lower = name.toLowerCase().trim();
  return nigerianBanks.find(b => b.name.toLowerCase() === lower || b.name.toLowerCase().includes(lower));
}

export function getBankByCode(code: string): NigerianBank | undefined {
  return nigerianBanks.find(b => b.code === code);
}
