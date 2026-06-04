
import { RiskLevel, Device, Alert, ChartDataPoint } from './types';

export interface ThreatFeedItem {
  id: string;
  cveId: string;
  severity: number;
  title: string;
  description: string;
  publishedDate: string;
  affectedSystems: string[];
}

export const DEVICES: Device[] = [
  { id: 'GW_01', name: 'IoT_Gateway_Main', type: 'router', ip: '192.168.1.1', status: 'online' },
  { id: 'CAM_04', name: 'CAM_EXT_04', type: 'videocam', ip: '192.168.1.105', status: 'blocked', details: 'Outdoor Camera - AUTO-BLOCKED' },
  { id: 'HVAC_01', name: 'HVAC_Main', type: 'thermostat', ip: '10.0.0.55', status: 'online' },
  { id: 'DOOR_01', name: 'Door_Rear', type: 'lock', status: 'online' },
  { id: 'SENS_A', name: 'Sensor_Cluster_A', type: 'sensors', ip: '192.168.1.200', status: 'online' },
  { id: 'LGHT_01', name: 'Light_Grid_01', type: 'lightbulb', ip: '192.168.1.50', status: 'online' },
];

export const ALERTS: Alert[] = [
  {
    id: 'ALT-992',
    risk: RiskLevel.CRITICAL,
    timestamp: '10:42:01',
    device: 'IoT_Gateway_Main',
    deviceId: 'GW_01',
    threat: 'Unauthorized Access Attempt',
    assessment: 'Integrity Fail',
    confidence: 99,
    description: 'Multiple failed SSH login attempts from unknown IP followed by privilege escalation pattern match.',
    tags: ['Brute Force', 'Root Access'],
    actionTaken: 'prevented'
  },
  {
    id: 'ALT-450',
    risk: RiskLevel.CRITICAL,
    timestamp: '10:40:55',
    device: 'CAM_EXT_04',
    deviceId: 'CAM_04',
    threat: 'Anomalous Outbound Traffic',
    assessment: 'Traffic Pattern',
    confidence: 92,
    description: 'Device transmitting large packets (450MB) to non-whitelisted external server. Botnet signature match confirmed.',
    tags: ['Exfiltration', 'Botnet'],
    actionTaken: 'blocked'
  },
  {
    id: 'ALT-102',
    risk: RiskLevel.WARNING,
    timestamp: '09:15:22',
    device: 'HVAC_Controller',
    deviceId: 'HVAC_01',
    threat: 'Unexpected Port Scan',
    assessment: 'Protocol Err',
    confidence: 75,
    description: 'Internal scan detected originating from this device targeting subnet 10.0.0.0/24.',
    tags: ['Reconnaissance'],
    actionTaken: 'detected'
  }
];


export const THREAT_FEED: ThreatFeedItem[] = [
  {
    id: 'T-1',
    cveId: 'CVE-2025-1042',
    severity: 9.8,
    title: 'Zero-Day RCE in Industrial Smart Controllers',
    description: 'A critical vulnerability in the MQTT handler allows unauthenticated remote code execution via malformed PUBLISH packets.',
    publishedDate: '2025-05-14',
    affectedSystems: ['Siemens X-Series', 'ABB SmartLog v4']
  },
  {
    id: 'T-2',
    cveId: 'CVE-2025-0881',
    severity: 8.1,
    title: 'Zigbee Mesh Topology Hijacking',
    description: 'An attacker within radio range can force devices to re-join a malicious coordinator node without authentication.',
    publishedDate: '2025-05-12',
    affectedSystems: ['Zigbee 3.0 Standard', 'Philips Hue Bridge (older firmware)']
  },
  {
    id: 'T-3',
    cveId: 'CVE-2025-0112',
    severity: 7.5,
    title: 'Hardcoded Credentials in IP Camera Firmware',
    description: 'Several manufacturers used identical factory maintenance passwords that cannot be changed by the end-user.',
    publishedDate: '2025-05-10',
    affectedSystems: ['Hikvision Generic Oem', 'Wyze Pro-Cam v2']
  }
];

export const TRAFFIC_DATA: ChartDataPoint[] = [
  { time: '00:00', value: 180 },
  { time: '02:00', value: 160 },
  { time: '04:00', value: 170 },
  { time: '06:00', value: 155 },
  { time: '08:00', value: 140 },
  { time: '10:00', value: 150 },
  { time: '12:00', value: 160 },
  { time: '14:00', value: 130 },
  { time: '16:00', value: 100 },
  { time: '18:00', value: 110 },
  { time: '20:00', value: 120 },
  { time: '22:00', value: 100 },
  { time: 'Now', value: 80 },
];
