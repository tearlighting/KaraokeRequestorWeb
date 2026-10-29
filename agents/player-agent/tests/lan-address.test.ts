import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NetworkInterfaceInfo } from 'node:os';
import { privateLanIpv4Addresses } from '../src/lan-address.js';

const info = (address: string, internal = false): NetworkInterfaceInfo => ({
  address, netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal, cidr: `${address}/24`,
});

test('LAN address reporting returns only private IPv4 candidates on physical interfaces', () => {
  const result = privateLanIpv4Addresses({
    'Wi-Fi': [info('192.168.1.24'), info('8.8.8.8'), info('10.0.0.5', true)],
    Ethernet: [info('10.20.0.7')],
    'vEthernet (WSL)': [info('172.20.0.1')],
    'Office VPN': [info('172.31.4.8')],
  });
  assert.deepEqual(result, ['10.20.0.7', '192.168.1.24']);
});
