import React from 'react';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import GeographicSecurityWidget from './GeographicSecurityWidget';

const MapWidgetTest = () => {
  const handleDragEnd = (event) => {
    // This will be handled by the GeographicSecurityWidget component
  };

  return (
    <DndContext 
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <GeographicSecurityWidget />
      <DragOverlay>
        {/* Drag overlay content */}
      </DragOverlay>
    </DndContext>
  );
};

export default MapWidgetTest;