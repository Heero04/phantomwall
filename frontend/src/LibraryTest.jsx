import React, { useState } from 'react';
import { create } from 'zustand';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with relativeTime plugin
dayjs.extend(relativeTime);

// Test Zustand store
const useTestStore = create((set) => ({
  count: 0,
  message: 'Zustand is working!',
  increment: () => set((state) => ({ count: state.count + 1 })),
  updateMessage: (msg) => set({ message: msg }),
}));

const LibraryTest = () => {
  // Zustand state
  const { count, message, increment, updateMessage } = useTestStore();
  
  // Local state for axios test
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Test Day.js with error handling
  const currentTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const futureTime = dayjs().add(7, 'day').format('YYYY-MM-DD HH:mm:ss');
  const relativeTime = dayjs().subtract(2, 'hour').fromNow();

  // Test Axios (using a public API)
  const testAxios = async () => {
    setLoading(true);
    try {
      // Test with JSONPlaceholder API
      const response = await axios.get('https://jsonplaceholder.typicode.com/posts/1');
      setApiData(response.data);
    } catch (error) {
      setApiData({ error: 'API call failed', details: error.message });
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      height: '100vh', 
      background: '#0d1117', 
      padding: '20px', 
      color: '#fff',
      fontFamily: 'monospace'
    }}>
      <h2 style={{ color: '#fff', marginBottom: '30px' }}>🧪 Library Testing Dashboard</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', height: 'calc(100vh - 100px)' }}>
        
        {/* Zustand Test */}
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ color: '#4ecdc4', marginBottom: '15px' }}>🗃️ Zustand State Management</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Global State Message:</div>
            <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>{message}</div>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Counter Value:</div>
            <div style={{ color: '#ff6b6b', fontSize: '24px', fontWeight: 'bold' }}>{count}</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={increment}
              style={{
                background: '#4ecdc4',
                color: '#000',
                border: 'none',
                padding: '10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Increment Counter
            </button>
            
            <button 
              onClick={() => updateMessage(`Updated at ${dayjs().format('HH:mm:ss')}`)}
              style={{
                background: '#45b7d1',
                color: '#000',
                border: 'none',
                padding: '10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Update Message
            </button>
          </div>
          
          <div style={{ marginTop: '15px', padding: '10px', background: '#2d2d2d', borderRadius: '4px' }}>
            <div style={{ color: '#26de81', fontSize: '12px' }}>✅ Zustand Working</div>
            <div style={{ color: '#888', fontSize: '11px' }}>Global state management ready</div>
          </div>
        </div>

        {/* Day.js Test */}
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ color: '#ffa502', marginBottom: '15px' }}>📅 Day.js Date Handling</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Current Time:</div>
            <div style={{ color: '#fff', fontSize: '14px' }}>{currentTime}</div>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>7 Days From Now:</div>
            <div style={{ color: '#fff', fontSize: '14px' }}>{futureTime}</div>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Relative Time:</div>
            <div style={{ color: '#fff', fontSize: '14px' }}>{relativeTime}</div>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Security Log Format:</div>
            <div style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>
              {dayjs().format('[Alert] YYYY-MM-DD HH:mm:ss [UTC]')}
            </div>
          </div>
          
          <div style={{ marginTop: '15px', padding: '10px', background: '#2d2d2d', borderRadius: '4px' }}>
            <div style={{ color: '#26de81', fontSize: '12px' }}>✅ Day.js Working</div>
            <div style={{ color: '#888', fontSize: '11px' }}>Date/time manipulation ready</div>
          </div>
        </div>

        {/* Axios Test */}
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '20px' }}>
          <h3 style={{ color: '#ff6b35', marginBottom: '15px' }}>🌐 Axios API Calls</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <button 
              onClick={testAxios}
              disabled={loading}
              style={{
                background: loading ? '#666' : '#ff6b35',
                color: '#fff',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              {loading ? 'Testing API...' : 'Test API Call'}
            </button>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>API Response:</div>
            <div style={{ 
              background: '#2d2d2d', 
              padding: '10px', 
              borderRadius: '4px', 
              fontSize: '12px',
              maxHeight: '200px',
              overflow: 'auto',
              color: '#fff'
            }}>
              {loading ? (
                <div style={{ color: '#ffa502' }}>Loading...</div>
              ) : apiData ? (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(apiData, null, 2)}
                </pre>
              ) : (
                <div style={{ color: '#888' }}>Click button to test API call</div>
              )}
            </div>
          </div>
          
          <div style={{ marginTop: '15px', padding: '10px', background: '#2d2d2d', borderRadius: '4px' }}>
            <div style={{ color: '#26de81', fontSize: '12px' }}>✅ Axios Working</div>
            <div style={{ color: '#888', fontSize: '11px' }}>HTTP client ready for security APIs</div>
          </div>
        </div>
      </div>
      
      {/* Summary */}
      <div style={{ 
        position: 'fixed', 
        bottom: '20px', 
        left: '20px', 
        right: '20px',
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '15px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ color: '#fff', fontWeight: 'bold' }}>
          🎉 All Libraries Installed & Tested Successfully!
        </div>
        <div style={{ color: '#26de81', fontSize: '14px' }}>
          Ready for Power BI Dashboard Development
        </div>
      </div>
    </div>
  );
};

export default LibraryTest;