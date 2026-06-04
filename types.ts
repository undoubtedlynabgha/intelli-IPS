
export enum RiskLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  WARNING = 'WARNING',
  INFO = 'INFO',
  ANOMALY = 'ANOMALY'
}

export interface Device {
  id: string;
  name: string;
  type: 'router' | 'videocam' | 'thermostat' | 'lock' | 'sensors' | 'lightbulb' | 'precision_manufacturing';
  ip?: string;
  mac?: string;
  status: 'online' | 'offline' | 'threat' | 'blocked';
  details?: string;
  allowed?: boolean;
}

export interface Alert {
  id: string;
  risk: RiskLevel;
  timestamp: string;
  device: string;
  deviceId: string;
  threat: string;
  assessment: string;
  confidence: number;
  description: string;
  tags: string[];
  actionTaken?: 'detected' | 'prevented' | 'blocked';
}

export interface ChartDataPoint {
  time: string;
  value: number;
}

