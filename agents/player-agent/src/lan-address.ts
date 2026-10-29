import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';

type InterfaceMap = Record<string, NetworkInterfaceInfo[] | undefined>;

export function privateLanIpv4Addresses(interfaces: InterfaceMap = networkInterfaces()): string[] {
  const ignoredInterface = /(vEthernet|Hyper-V|WSL|Docker|VirtualBox|VMware|Loopback|Teredo|Tunnel|VPN)/i;
  const values = new Set<string>();
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (ignoredInterface.test(name)) continue;
    for (const address of addresses || []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      const octets = address.address.split('.').map(Number);
      if (octets.length !== 4 || !octets.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) continue;
      const [a, b] = octets;
      if (a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31) values.add(address.address);
    }
  }
  return [...values].sort((left, right) => left.localeCompare(right, undefined, { numeric: true })).slice(0, 16);
}
