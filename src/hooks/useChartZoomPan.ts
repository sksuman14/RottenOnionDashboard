import { useState, useCallback, useEffect, useRef } from 'react';

export function useChartZoomPan(data: any[]) {
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);

  const isPanningRef = useRef(false);
  const startXRef = useRef(0);
  const panAccumulatorRef = useRef(0);

  useEffect(() => {
    setStartIndex(0);
    setEndIndex(0);
    panAccumulatorRef.current = 0;
  }, [data]);

  const displayedData = data.length > 0 ? data.slice(
     startIndex, 
     endIndex === 0 ? data.length : endIndex + 1
  ) : [];

  const handleWheel = useCallback((e: React.WheelEvent) => {
     if (data.length === 0) return;
     const currentLen = data.length;
     
     let currentStart = startIndex;
     let currentEnd = endIndex === 0 ? currentLen - 1 : endIndex;
     const windowSize = currentEnd - currentStart;
     
     if (e.shiftKey) {
        // Zooming (Shift + Wheel)
        if (e.deltaY === 0) return;
        let zoomAmount = Math.max(1, Math.round(windowSize * 0.1));
        if (e.deltaY < 0) {
           // Zoom In
           if (windowSize <= 6) return;
           currentStart += zoomAmount;
           currentEnd -= zoomAmount;
        } else {
           // Zoom Out
           currentStart -= zoomAmount;
           currentEnd += zoomAmount;
        }
     } else {
        // Panning (Wheel without Shift)
        if (windowSize === currentLen - 1) return; // Cannot pan if fully zoomed out
        
        let panDelta = 0;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            panDelta = e.deltaX; // Horizontal scroll
        } else if (e.deltaY !== 0) {
            panDelta = e.deltaY; // Vertical scroll
        } else {
            return;
        }
        
        let panAmount = panDelta > 0 ? 1 : -1;
        panAmount = Math.round(panAmount * Math.max(1, windowSize * 0.05)); 
        
        currentStart += panAmount;
        currentEnd += panAmount;
     }

     // Clamp values
     if (currentStart < 0) {
        currentEnd -= currentStart;
        currentStart = 0;
     }
     if (currentEnd >= currentLen) {
        currentStart -= (currentEnd - (currentLen - 1));
        currentEnd = currentLen - 1;
     }
     
     currentStart = Math.max(0, currentStart);
     currentEnd = Math.min(currentLen - 1, currentEnd);

     setStartIndex(currentStart);
     setEndIndex(currentEnd);
  }, [data, startIndex, endIndex]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
     // Allow dragging with ANY mouse button (left or right)
     isPanningRef.current = true;
     startXRef.current = e.clientX;
     panAccumulatorRef.current = 0;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
     if (!isPanningRef.current || data.length === 0) return;
     
     const currentLen = data.length;
     let currentStart = startIndex;
     let currentEnd = endIndex === 0 ? currentLen - 1 : endIndex;
     const windowSize = currentEnd - currentStart;
     
     if (windowSize === currentLen - 1) return; // Cannot pan if fully zoomed out
     
     const dx = e.clientX - startXRef.current;
     startXRef.current = e.clientX; // update current X
     
     const containerWidth = 600; // approximate width of the chart
     const pixelsPerIndex = Math.max(0.5, containerWidth / windowSize);
     
     panAccumulatorRef.current += (-dx / pixelsPerIndex);
     
     if (Math.abs(panAccumulatorRef.current) >= 1) {
        let shift = Math.trunc(panAccumulatorRef.current);
        panAccumulatorRef.current -= shift;
        
        let newStart = currentStart + shift;
        let newEnd = currentEnd + shift;
        
        if (newStart < 0) {
           newEnd -= newStart;
           newStart = 0;
           panAccumulatorRef.current = 0; // reset
        }
        if (newEnd >= currentLen) {
           newStart -= (newEnd - (currentLen - 1));
           newEnd = currentLen - 1;
           panAccumulatorRef.current = 0; // reset
        }
        newStart = Math.max(0, newStart);
        newEnd = Math.min(currentLen - 1, newEnd);
        
        if (newStart !== currentStart) {
           setStartIndex(newStart);
           setEndIndex(newEnd);
        }
     }
  }, [data, startIndex, endIndex]);

  const handleMouseUp = useCallback(() => {
     isPanningRef.current = false;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
     e.preventDefault();
  }, []);

  const handleResetZoom = useCallback(() => {
     setStartIndex(0);
     setEndIndex(0);
     panAccumulatorRef.current = 0;
  }, []);

  return {
     displayedData,
     handleWheel,
     handleMouseDown,
     handleMouseMove,
     handleMouseUp,
     handleContextMenu,
     handleResetZoom,
     isZoomed: endIndex !== 0 && (endIndex - startIndex < data.length - 1)
  };
}
