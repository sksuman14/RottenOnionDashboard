import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

// Custom Tooltip
const CustomTooltip = ({ active, payload, label, unit = '' }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    // Show either the full TimeStamp_IST or combine dateLabel with the time label
    const dateText = dataPoint.TimeStamp_IST || (dataPoint.dateLabel ? `${dataPoint.dateLabel} ${label}` : label);
    return (
      <div style={{ backgroundColor: 'rgba(10, 10, 10, 0.85)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', boxShadow: '0 8px 16px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{dateText}</div>
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [devices, setDevices] = useState<CloudSenseDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<CloudSenseDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1 day');
  const [selectedDate, setSelectedDate] = useState('2024-10-30');
  const [startDate, setStartDate] = useState('2024-03-01');
  const [endDate, setEndDate] = useState('2024-10-30');
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
  useEffect(() => {
    if (activeTab === 'live') {
      setLoading(true);
      
      // Generate static list of devices 1 to 20
      const staticDevices: CloudSenseDevice[] = Array.from({ length: 20 }, (_, i) => ({
        DeviceId: `OMD-${String(i + 1).padStart(3, '0')}`,
        Topic: `onion-monitor/OMD-${String(i + 1).padStart(3, '0')}/telemetry`,
        TimeStamp_IST: '2024-10-30 23:00:00',
        City: 'IIT Ropar',
        State: 'Punjab',
        WindSpeed: 0,
        WindDirection: 0,
        CurrentTemperature: 15,
        CurrentHumidity: 50,
        BatteryVoltage: 12.0,
        SignalStrength: -70,
        H2S: 0,
        CO2: 400,
        NH3: 0,
        SO2: 0,
        StateCode: 0
      }));

      setDevices(staticDevices);
      setLoading(false);
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
        start = selectedDate;
        end = selectedDate;
      } else if (timeRange === '7 day') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        start = d.toISOString().split('T')[0];
        end = todayStr;
      } else if (timeRange === 'Custom') {
        start = startDate;
        end = endDate;
      }
      
      if (!start || !end) return;
      
      setHistoryLoading(true);
      
      try {
        // Extract numeric ID if it starts with OMD- (e.g. OMD-001 -> 1)
        const numericId = selectedDevice.DeviceId.replace(/\D/g, '') || '1';
        
        const url = `/api/default/Rotten_oninon_data_fetch?deviceId=${parseInt(numericId, 10)}&startDate=${start}&endDate=${end}`;
        console.log("Fetching URL:", url);
        
        const res = await fetch(url);
        console.log("Response Status:", res.status);
        
        let responseText = await res.text();
        console.log("Raw Response (first 300 chars):", responseText.substring(0, 300));
        
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          console.error("Error parsing response to JSON:", parseError);
          return;
        }
        
        // Handle case where Lambda returns a proxy integration response with a stringified body
        if (responseData.body && typeof responseData.body === 'string') {
          console.log("Found stringified body, parsing inner JSON...");
          try {
            responseData = JSON.parse(responseData.body);
          } catch (e) {
            console.error('Failed to parse inner response body:', e);
          }
        }
        
        if (isMounted) {
          const apiData = responseData.data || [];
          console.log("Final extracted 'data' array length:", apiData.length);
          if (apiData.length > 0) {
            const formatted = apiData.map((d: any) => {
              // Use epoch if available, fallback to parsing timestamp string
              const dateObj = d.epoch ? new Date(d.epoch * 1000) : new Date(d.timestamp.replace(' ', 'T'));
              return {
                ...d,
                H2S: d.h2s,
                CO2: d.co2,
                NH3: d.nh3,
                SO2: d.so2,
                CurrentTemperature: d.temperature,
                CurrentHumidity: d.humidity,
                TimeStamp_IST: d.timestamp,
                epochMs: dateObj.getTime(),
                timeLabel: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                dateLabel: dateObj.toLocaleDateString(),
              };
            });
            formatted.sort((a: any, b: any) => a.epochMs - b.epochMs);
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

  const latestMetrics = historyData.length > 0 ? historyData[historyData.length - 1] : selectedDevice;

  const renderChart = (title: string, dataKey: string, color: string, unit: string, zoomPanHook: any) => {
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
            <ResponsiveContainer width="100%" height={300} minWidth={10}>
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
                
                <Line 
                  type="monotone" 
                  dataKey={dataKey} 
                  stroke={color} 
                  name={title}
                  strokeWidth={2} 
                  dot={{ r: 2, strokeWidth: 0, fill: color }} 
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
          <a href="mailto:Vikash.hardwareengineer@ihub-awadh.in" className="nav-item">
            Contact Support
          </a>
        </div>
        
        <div className="nav-actions">
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-menu-dropdown animate-fade-in">
          <div 
            className={`mobile-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveTab('overview'); setMobileMenuOpen(false); }}
          >
            Overview
          </div>
          <div 
            className={`mobile-nav-item ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => { setActiveTab('live'); setMobileMenuOpen(false); }}
          >
            Live Network
          </div>
          <div 
            className={`mobile-nav-item ${activeTab === 'specs' ? 'active' : ''}`}
            onClick={() => { setActiveTab('specs'); setMobileMenuOpen(false); }}
          >
            Hardware Specs
          </div>
          <a href="mailto:Vikash.hardwareengineer@ihub-awadh.in" className="mobile-nav-item" style={{ color: 'var(--primary)', marginTop: '0.5rem', fontWeight: 600 }}>
            Contact Support
          </a>
        </div>
      )}

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
            
            {!selectedDevice ? (
              <div className="glass-card animate-fade-in" style={{ width: '100%' }}>
                <h3 style={{ marginBottom: '2rem', fontSize: '1.75rem' }}>Deployed Units</h3>
                {loading ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--primary)', fontSize: '1.25rem' }}>Loading devices...</div>
                ) : devices.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', textAlign: 'center', padding: '2rem' }}>No active OMD devices found.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {devices.map(device => (
                      <div 
                        key={device.DeviceId}
                        onClick={() => setSelectedDevice(device)}
                        style={{
                          padding: '1.5rem',
                          borderRadius: '1rem',
                          cursor: 'pointer',
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          border: `1px solid var(--glass-border)`,
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.borderColor = 'var(--glass-border)';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 600, fontSize: '1.25rem', color: '#fff' }}>
                            {device.DeviceId}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: getDeviceStatusColor(device.StateCode), display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.75rem', borderRadius: '999px' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getDeviceStatusColor(device.StateCode), boxShadow: `0 0 8px ${getDeviceStatusColor(device.StateCode)}` }}></span>
                            {getDeviceStatusLabel(device.StateCode)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            {device.City}, {device.State}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
                            Last Sync: {device.TimeStamp_IST}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
                {/* Navigation Back Button */}
                <div>
                  <button 
                    onClick={() => setSelectedDevice(null)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-secondary)',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Back to Device List
                  </button>
                </div>

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
                            Last Synced: {latestMetrics?.TimeStamp_IST ?? selectedDevice.TimeStamp_IST}
                          </p>
                        </div>
                      </div>

                      {/* 6-Grid Live Data */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hydrogen Sulphide</div>
                          <div className="metric-value" style={{ color: '#fbbf24' }}>
                            {latestMetrics?.H2S ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>ppm</span>
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Carbon Dioxide</div>
                          <div className="metric-value" style={{ color: '#d4d4d8' }}>
                            {latestMetrics?.CO2 ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>ppm</span>
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ammonia (NH3)</div>
                          <div className="metric-value" style={{ color: '#10b981' }}>
                            {latestMetrics?.NH3 ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>ppm</span>
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sulphur Dioxide</div>
                          <div className="metric-value" style={{ color: '#f43f5e' }}>
                            {latestMetrics?.SO2 ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>ppm</span>
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Temperature</div>
                          <div className="metric-value" style={{ color: '#f87171' }}>
                            {latestMetrics?.CurrentTemperature ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>°C</span>
                          </div>
                        </div>
                        <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rel. Humidity</div>
                          <div className="metric-value" style={{ color: '#60a5fa' }}>
                            {latestMetrics?.CurrentHumidity ?? '--'} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', textShadow: 'none' }}>%</span>
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
                            {['1 day', 'Custom'].map((range) => (
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {renderChart("Hydrogen Sulphide", "H2S", "#fbbf24", "ppm", zoomPanH2S)}
                          {renderChart("Carbon Dioxide", "CO2", "#d4d4d8", "ppm", zoomPanCO2)}
                          {renderChart("Ammonia", "NH3", "#10b981", "ppm", zoomPanNH3)}
                          {renderChart("Sulphur Dioxide", "SO2", "#f43f5e", "ppm", zoomPanSO2)}
                          {renderChart("Temperature", "CurrentTemperature", "#f87171", "°C", zoomPanTemp)}
                          {renderChart("Humidity", "CurrentHumidity", "#60a5fa", "%", zoomPanHum)}
                      </div>
                    </div>
              </div>
            )}
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
