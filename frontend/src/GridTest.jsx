import React from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const GridTest = () => {
  const layouts = {
    lg: [
      { i: 'test1', x: 0, y: 0, w: 6, h: 4 },
      { i: 'test2', x: 6, y: 0, w: 6, h: 4 },
    ]
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>🧪 Grid Layout Test</h2>
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={60}
        isDraggable={true}
        isResizable={true}
      >
        <div key="test1" style={{ background: '#f0f0f0', border: '1px solid #ccc', padding: '10px' }}>
          📊 Widget 1 - Drag me!
        </div>
        <div key="test2" style={{ background: '#e0f0ff', border: '1px solid #aac', padding: '10px' }}>
          📈 Widget 2 - Resize me!
        </div>
      </ResponsiveGridLayout>
    </div>
  );
};

export default GridTest;