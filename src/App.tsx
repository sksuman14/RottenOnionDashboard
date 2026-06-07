import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useChartZoomPan } from './hooks/useChartZoomPan';
import './index.css';

interface CloudSenseDevice {
  DeviceId: string;
  Topic: string;
  TimeStamp_IST: string;
  City: string;
  State: string;
  WindSpeed: number;
  WindDirection: number;
  CurrentTemperature: number;
  CurrentHumidity: number;
  BatteryVoltage: number;
  SignalStrength: number;
  H2S?: number;
  CO2?: number;
  NH3?: number;
  SO2?: number;
  StateCode?: number; // 0=healthy, 1=warning, 2=critical
}

const formatDateToDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
};

// Custom Tooltip
const CustomTooltip = ({ active, payload, label, unit = '' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: 'rgba(10, 10, 10, 0.85)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', boxShadow: '0 8px 16px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: payload[0].color, marginBottom: '2px', textShadow: `0 0 8px ${payload[0].color}66` }}>
            {payload[0].name}: {payload[0].value} {unit}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  
  const [devices, setDevices] = useState<CloudSenseDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<CloudSenseDevice | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('1 day');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 6 Independent zoom hooks
  const zoomPanH2S = useChartZoomPan(historyData);
  const zoomPanCO2 = useChartZoomPan(historyData);
  const zoomPanNH3 = useChartZoomPan(historyData);
  const zoomPanSO2 = useChartZoomPan(historyData);
  const zoomPanTemp = useChartZoomPan(historyData);
  const zoomPanHum = useChartZoomPan(historyData);

  const isAnyZoomed = zoomPanH2S.isZoomed || zoomPanCO2.isZoomed || zoomPanNH3.isZoomed || 
                      zoomPanSO2.isZoomed || zoomPanTemp.isZoomed || zoomPanHum.isZoomed;
  
  const handleResetZoom = () => {
    zoomPanH2S.handleResetZoom();
    zoomPanCO2.handleResetZoom();
    zoomPanNH3.handleResetZoom();
    zoomPanSO2.handleResetZoom();
    zoomPanTemp.handleResetZoom();
    zoomPanHum.handleResetZoom();
  };

  const bannerPoints = [
    "Continuous post-harvest onion storage monitoring",
    "H2S-based early spoilage detection (below 0.10 ppm)",
    "Selective sensor activation for extended battery life (~6 days)",
  ];

  const features = [
    "6-parameter measurement: H2S, CO2, NH3, SO2, Temp, RH",
    "High-accuracy Winsen electrochemical & NDIR sensors",
    "Quectel 4G LTE cellular module for real-time cloud sync",
    "Active air sampling with a DC suction motor (2 min ON / 58 min OFF)",
    "Three-stage operational alerts: Healthy, Warning/Early Rot, Critical",
  ];

  const applications = [
    "Onion storage warehouses and bulk storage facilities",
    "Cold room storage centers",
    "Agricultural supply chains and transit points",
    "Agritech cooperatives and distributors",
  ];

  const specifications = [
    { label: "Processing Unit", value: "Nordic nRF5340 (Dual-core Arm Cortex-M33)" },
    { label: "Gas Sensors", value: "Winsen ZE03-H2S, ZE03-SO2, ZE03-NH3, MH-Z19E (CO2)" },
    { label: "Environmental Sensor", value: "Sensirion SHT40 (Temp/RH)" },
    { label: "Sampling Mechanism", value: "DC Suction Motor (2 min ON / 58 min OFF cycle)" },
    { label: "Cellular Connectivity", value: "Quectel EC200U-CN 4G LTE (Cat-1)" },
    { label: "Power Source", value: "11.1V / 10Ah Lithium-ion battery pack with BMS" },
    { label: "Battery Runtimes", value: "~6.03 days (Healthy Mode), ~4.8 days (Critical Mode)" },
    { label: "Enclosure", value: "150mm x 100mm x 60mm ABS Plastic (IP54 rated)" },
    { label: "Weight", value: "~380g (with battery)" },
    { label: "Visual Indication", value: "RGB status LED + Buzzer" }
  ];

  const getDeviceStatusColor = (stateCode?: number) => {
    if (stateCode === 2) return 'var(--danger)'; // Critical
    if (stateCode === 1) return 'var(--warning)'; // Warning
    return 'var(--success)'; // Healthy
  };

  const getDeviceStatusLabel = (stateCode?: number) => {
    if (stateCode === 2) return 'Critical';
    if (stateCode === 1) return 'Warning';
    return 'Healthy';
  };

  // Generate Mock Data for OMD
  const generateMockHistory = (deviceId: string, startStr: string, endStr: string) => {
    const data = [];
    const now = new Date();
    const startDateObj = new Date(startStr.split('-').reverse().join('-'));
    const endDateObj = new Date(endStr.split('-').reverse().join('-'));
    endDateObj.setHours(23, 59, 59);

    let current = new Date(startDateObj);
    const isWarning = deviceId === 'OMD-002';

    while (current <= endDateObj && current <= now) {
      let baseH2S = isWarning ? 0.12 : 0.05;
      let baseCO2 = isWarning ? 1200 : 750;
      let baseNH3 = isWarning ? 0.25 : 0.10;
      let baseSO2 = isWarning ? 0.06 : 0.02;
      let baseTemp = isWarning ? 18 : 12;
      let baseHum = isWarning ? 65 : 62;

      data.push({
        TimeStamp_IST: current.toISOString().replace('T', ' ').substring(0, 19),
        timeLabel: current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateLabel: current.toLocaleDateString(),
        H2S: +(baseH2S + (Math.random() * 0.04 - 0.02)).toFixed(2),
        CO2: +(baseCO2 + (Math.random() * 100 - 50)).toFixed(0),
        NH3: +(baseNH3 + (Math.random() * 0.05 - 0.025)).toFixed(2),
        SO2: +(baseSO2 + (Math.random() * 0.02 - 0.01)).toFixed(2),
        CurrentTemperature: +(baseTemp + (Math.random() * 2 - 1)).toFixed(1),
        CurrentHumidity: +(baseHum + (Math.random() * 4 - 2)).toFixed(1)
      });
      current.setHours(current.getHours() + 1);
    }
    return data;
  };

  useEffect(() => {
    if (activeTab === 'live') {
      setLoading(true);
      fetch('https://d1b09mxwt0ho4j.cloudfront.net/default/WS_Device_Activity')
        .then(res => res.json())
        .then(data => {
          let filtered: CloudSenseDevice[] = [];
          if (data && data.devices) {
            filtered = data.devices.filter((d: any) => 
              (d.DeviceId && d.DeviceId.startsWith('OMD')) || (d.Topic && d.Topic.toLowerCase().includes('onion'))
            );
          }
          // Local fallback mock
          if (filtered.length === 0) {
            filtered = [
              {
                DeviceId: 'OMD-001',
                Topic: 'onion-monitor/OMD-001/telemetry',
                TimeStamp_IST: new Date().toISOString().replace('T', ' ').substring(0, 19),
                City: 'Nashik',
                State: 'Maharashtra',
                WindSpeed: 0,
                WindDirection: 0,
                CurrentTemperature: 12.5,
                CurrentHumidity: 63.0,
                BatteryVoltage: 11.8,
                SignalStrength: -65,
                H2S: 0.06,
                CO2: 800,
                NH3: 0.12,
                SO2: 0.03,
                StateCode: 0
              },
              {
                DeviceId: 'OMD-002',
                Topic: 'onion-monitor/OMD-002/telemetry',
                TimeStamp_IST: new Date().toISOString().replace('T', ' ').substring(0, 19),
                City: 'Lasalgaon',
                State: 'Maharashtra',
                WindSpeed: 0,
                WindDirection: 0,
                CurrentTemperature: 18.2,
                CurrentHumidity: 68.5,
                BatteryVoltage: 11.2,
                SignalStrength: -72,
                H2S: 0.14,
                CO2: 1450,
                NH3: 0.28,
                SO2: 0.07,
                StateCode: 1
              }
            ];
          }

          setDevices(filtered);
          if (filtered.length > 0) {
            setSelectedDevice(filtered[0]);
          }
        })
        .catch(err => console.error("Error fetching CloudSense data:", err))
        .finally(() => setLoading(false));
    }
  }, [activeTab]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchHistory = async () => {
      if (activeTab !== 'live' || !selectedDevice) return;
      
      let start = '';
      let end = '';
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      if (timeRange === '1 day') {
        start = formatDateToDDMMYYYY(selectedDate);
        end = formatDateToDDMMYYYY(selectedDate);
      } else if (timeRange === '7 day') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        start = formatDateToDDMMYYYY(d.toISOString().split('T')[0]);
        end = formatDateToDDMMYYYY(todayStr);
      } else if (timeRange === 'Custom') {
        start = formatDateToDDMMYYYY(startDate);
        end = formatDateToDDMMYYYY(endDate);
      }
      
      if (!start || !end) return;
      
      setHistoryLoading(true);
      
      if (selectedDevice.DeviceId.startsWith('OMD')) {
        setTimeout(() => {
          if (isMounted) {
            setHistoryData(generateMockHistory(selectedDevice.DeviceId, start, end));
            setHistoryLoading(false);
          }
        }, 500);
        return;
      }

      try {
        const url = `https://gtk47vexob.execute-api.us-east-1.amazonaws.com/ssmet0126data?deviceid=${selectedDevice.DeviceId}&start_date=${start}&end_date=${end}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (isMounted) {
          if (data && data.length > 0) {
            const formatted = data.map((d: any) => ({
              ...d,
              timeLabel: new Date(d.TimeStamp_IST).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              dateLabel: new Date(d.TimeStamp_IST).toLocaleDateString(),
            }));
            formatted.sort((a: any, b: any) => new Date(a.TimeStamp_IST).getTime() - new Date(b.TimeStamp_IST).getTime());
            setHistoryData(formatted);
          } else {
            setHistoryData([]);
          }
        }
      } catch (err) {
        console.error("Error fetching historical data:", err);
        if (isMounted) setHistoryData([]);
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    };

    fetchHistory();
    return () => { isMounted = false; };
  }, [activeTab, selectedDevice, timeRange, selectedDate, startDate, endDate]);

  const renderChart = (title: string, dataKey: string, color: string, unit: string, zoomPanHook: any, thresholds?: { warning?: number, critical?: number }) => {
    const { displayedData, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel } = zoomPanHook;
    
    return (
      <div className="glass-card interactive" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '1rem', color: color, textShadow: `0 0 10px ${color}44` }}>{title} ({unit})</h3>
        <div 
            style={{ flex: 1, height: '300px', width: '100%', position: 'relative', userSelect: 'none' }}
            onWheelCapture={handleWheel}
            onMouseDownCapture={handleMouseDown}
            onMouseMoveCapture={handleMouseMove}
            onMouseUpCapture={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={(e) => e.preventDefault()}
        >
          {historyLoading ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: 'var(--primary)', animation: 'pulse 2s infinite' }}>Loading data...</div>
            </div>
          ) : displayedData.length === 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              No data available for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="timeLabel" 
                  stroke="var(--text-secondary)" 
                  fontSize={12} 
                  tickMargin={10}
                  allowDataOverflow
                  type="category"
                  minTickGap={20}
                />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => `${val}`} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip unit={unit} />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                
                {thresholds?.warning && <ReferenceLine y={thresholds.warning} stroke="var(--warning)" strokeDasharray="3 3" label={{ position: 'top', value: 'Warning', fill: 'var(--warning)', fontSize: 10 }} />}
                {thresholds?.critical && <ReferenceLine y={thresholds.critical} stroke="var(--danger)" strokeDasharray="3 3" label={{ position: 'top', value: 'Critical', fill: 'var(--danger)', fontSize: 10 }} />}
                
                <Line 
                  type="monotone" 
                  dataKey={dataKey} 
                  stroke={color} 
                  name={title}
                  strokeWidth={3} 
                  dot={false} 
                  activeDot={{ r: 6, fill: color, stroke: '#000', strokeWidth: 2 }}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-layout">
      {/* Top Navigation Bar */}
      <nav className="top-nav">
        <div className="nav-brand">
          <span style={{ fontSize: '1.75rem' }}>🧅</span>
          <h2>OMD System</h2>
        </div>
        
        <div className="nav-links">
          <div 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </div>
          <div 
            className={`nav-item ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            Live Network
          </div>
          <div 
            className={`nav-item ${activeTab === 'specs' ? 'active' : ''}`}
            onClick={() => setActiveTab('specs')}
          >
            Hardware Specs
          </div>
        </div>
        
        <div className="nav-actions">
          <a href="mailto:Vikash.hardwareengineer@ihub-awadh.in" className="btn btn-primary">
            Contact Support
          </a>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <div className="glass-card" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', backgroundImage: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(10, 10, 10, 0.1))' }}>
              <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', textShadow: '0 4px 20px rgba(139,92,246,0.3)' }}>Onion Monitor Device (OMD)</h1>
                <p style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '1rem auto 0' }}>Next-generation post-harvest storage monitoring to detect early spoilage before it spreads.</p>
              </div>
              <div style={{ padding: '1rem', borderRadius: '1.5rem', background: 'rgba(0,0,0,0.3)', display: 'inline-flex', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)' }}>
                  <img src="/assets/onion_sensor.png" alt="Onion Monitor Device" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '1rem', objectFit: 'contain' }} />
              </div>
            </div>

            <div className="grid grid-cols-3">
              <div className="glass-card interactive">
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', color: 'var(--primary)' }}>Key Highlights</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {bannerPoints.map((point, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <div style={{ color: 'var(--accent)', fontSize: '1.25rem' }}>✦</div>
                      <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{point}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card interactive">
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', color: 'var(--primary)' }}>Hardware Features</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {features.map((feature, idx) => (
                    <li key={idx} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{feature}</li>
                  ))}
                </ul>
              </div>

              <div className="glass-card interactive">
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', color: 'var(--primary)' }}>Supported Applications</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {applications.map((app, idx) => (
                    <li key={idx} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{app}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Live Network Tab */}
        {activeTab === 'live' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
            
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              
              {/* Sidebar Device List - Restyled to match new theme */}
              <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="glass-card">
                  <h3 style={{ marginBottom: '1.5rem' }}>Deployed Units</h3>
                  {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--primary)' }}>Loading...</div>
                  ) : devices.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No active OMD devices found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                      {devices.map(device => (
                        <div 
                          key={device.DeviceId}
                          onClick={() => setSelectedDevice(device)}
                          style={{
                            padding: '1rem',
                            borderRadius: '1rem',
                            cursor: 'pointer',
                            backgroundColor: selectedDevice?.DeviceId === device.DeviceId ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${selectedDevice?.DeviceId === device.DeviceId ? 'var(--primary)' : 'var(--glass-border)'}`,
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem', color: selectedDevice?.DeviceId === device.DeviceId ? '#fff' : 'var(--text-primary)' }}>
                              {device.DeviceId}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                              {device.City}, {device.State}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: getDeviceStatusColor(device.StateCode), display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getDeviceStatusColor(device.StateCode), boxShadow: `0 0 8px ${getDeviceStatusColor(device.StateCode)}` }}></span>
                            {getDeviceStatusLabel(device.StateCode)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ flex: '3 1 600px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {selectedDevice ? (
                  <>
                    {/* Hero Widget for Selected Device */}
                    <div className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', borderRadius: '50%' }}></div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
                        <div>
                          <h2 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {selectedDevice.DeviceId} 
                            <span className="status-badge" style={{ backgroundColor: getDeviceStatusColor(selectedDevice.StateCode) + '22', color: getDeviceStatusColor(selectedDevice.StateCode), border: `1px solid ${getDeviceStatusColor(selectedDevice.StateCode)}44` }}>
                                <span className="status-dot" style={{ backgroundColor: getDeviceStatusColor(selectedDevice.StateCode) }}></span>
                                {getDeviceStatusLabel(selectedDevice.StateCode)}
                            </span>
                          </h2>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.5rem 0 0 0' }}>
                            Last Synced: {selectedDevice.TimeStamp_IST} | Battery: <span style={{ color: '#fff' }}>{selectedDevice.BatteryVoltage}V</span>
                          </p>
                        </div>
                      </div>

                      {/* 6-Grid Live Data */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hydrogen Sulphide</div>
                          <div className="metric-value" style={{ color: '#fbbf24' }}>
                            {selectedDevice.H2S ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>ppm</span>
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Carbon Dioxide</div>
                          <div className="metric-value" style={{ color: '#d4d4d8' }}>
                            {selectedDevice.CO2 ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>ppm</span>
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ammonia (NH3)</div>
                          <div className="metric-value" style={{ color: '#10b981' }}>
                            {selectedDevice.NH3 ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>ppm</span>
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sulphur Dioxide</div>
                          <div className="metric-value" style={{ color: '#f43f5e' }}>
                            {selectedDevice.SO2 ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>ppm</span>
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Temperature</div>
                          <div className="metric-value" style={{ color: '#f87171' }}>
                            {selectedDevice.CurrentTemperature ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>°C</span>
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rel. Humidity</div>
                          <div className="metric-value" style={{ color: '#60a5fa' }}>
                            {selectedDevice.CurrentHumidity ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Historical Data Section */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Historical Trends</h2>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          {isAnyZoomed && (
                            <button className="btn btn-outline" onClick={handleResetZoom}>
                              Reset Zoom
                            </button>
                          )}
                          <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '999px', padding: '0.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {['1 day', '7 day', 'Custom'].map((range) => (
                              <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                style={{
                                  padding: '0.5rem 1rem',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  backgroundColor: timeRange === range ? 'var(--primary)' : 'transparent',
                                  color: timeRange === range ? '#fff' : 'var(--text-secondary)',
                                  border: 'none',
                                  borderRadius: '999px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                              >
                                {range}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {timeRange === '1 day' && (
                        <div style={{ marginBottom: '1.5rem' }}>
                          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }} />
                        </div>
                      )}
                      
                      {timeRange === 'Custom' && (
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>to</span>
                          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }} />
                        </div>
                      )}

                      {/* 6 Independent Zoomable Charts */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                          {renderChart("Hydrogen Sulphide", "H2S", "#fbbf24", "ppm", zoomPanH2S, { warning: 0.10, critical: 0.20 })}
                          {renderChart("Carbon Dioxide", "CO2", "#d4d4d8", "ppm", zoomPanCO2, { warning: 900, critical: 3500 })}
                          {renderChart("Ammonia", "NH3", "#10b981", "ppm", zoomPanNH3, { warning: 0.20, critical: 0.50 })}
                          {renderChart("Sulphur Dioxide", "SO2", "#f43f5e", "ppm", zoomPanSO2, { warning: 0.05, critical: 0.10 })}
                          {renderChart("Temperature", "CurrentTemperature", "#f87171", "°C", zoomPanTemp, { warning: 15, critical: 20 })}
                          {renderChart("Humidity", "CurrentHumidity", "#60a5fa", "%", zoomPanHum, { warning: 80, critical: 85 })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                    Select a device from the list on the left to view its real-time and historical telemetry.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hardware Specs Tab */}
        {activeTab === 'specs' && (
          <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '2rem', fontSize: '2.5rem', textAlign: 'center' }}>Hardware Specifications</h2>
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Specification Details</th>
                  </tr>
                </thead>
                <tbody>
                  {specifications.map((spec, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: '#fff', width: '30%' }}>{spec.label}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
