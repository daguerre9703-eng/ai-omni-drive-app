import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Line, G } from 'react-native-svg';

type DirectionType = 'left' | 'straight' | 'right' | 'uturn';

interface ARNavigationArrowProps {
  direction: DirectionType;
  cameraActive: boolean;
}

export default function ARNavigationArrow({ direction, cameraActive }: ARNavigationArrowProps) {
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    if (!cameraActive) {
      return;
    }

    const interval = setInterval(() => {
      setPulseIndex((prev) => (prev + 1) % 5);
    }, 600);
    return () => clearInterval(interval);
  }, [cameraActive]);

  const getArrowPath = (direction: DirectionType, index: number) => {
    const yOffset = index * -80;

    switch (direction) {
      case 'straight':
        return `M 200 ${600 + yOffset} L 200 ${450 + yOffset} L 150 ${500 + yOffset} M 200 ${450 + yOffset} L 250 ${500 + yOffset}`;
      case 'left':
        return `M 250 ${600 + yOffset} Q 200 ${500 + yOffset} 100 ${450 + yOffset} L 130 ${480 + yOffset} M 100 ${450 + yOffset} L 130 ${420 + yOffset}`;
      case 'right':
        return `M 150 ${600 + yOffset} Q 200 ${500 + yOffset} 300 ${450 + yOffset} L 270 ${420 + yOffset} M 300 ${450 + yOffset} L 270 ${480 + yOffset}`;
      case 'uturn':
        return `M 200 ${600 + yOffset} Q 200 ${500 + yOffset} 150 ${450 + yOffset} Q 100 ${400 + yOffset} 150 ${350 + yOffset} L 130 ${380 + yOffset} M 150 ${350 + yOffset} L 170 ${370 + yOffset}`;
      default:
        return '';
    }
  };

  const getOpacity = (index: number) => {
    const distance = (5 + index - pulseIndex) % 5;
    return 1 - (distance * 0.15);
  };

  const getScale = (index: number) => {
    const distance = (5 + index - pulseIndex) % 5;
    return 1 - (distance * 0.12);
  };

  if (!cameraActive) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {/* AR 그리드 배경 */}
      <Svg width="100%" height="100%" viewBox="0 0 400 700" style={styles.svg}>
        {/* 원근 그리드 */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Line
            key={`h-${i}`}
            x1="0"
            y1={100 + i * 100}
            x2="400"
            y2={100 + i * 100}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="1"
          />
        ))}

        {/* 5개 화살표 시퀀스 */}
        {[0, 1, 2, 3, 4].map((index) => {
          const isActive = index === pulseIndex;
          const opacity = getOpacity(index);
          const scale = getScale(index);

          return (
            <G
              key={index}
              opacity={opacity}
              origin="200, 350"
              scale={scale}
            >
              {/* 메인 화살표 */}
              <Path
                d={getArrowPath(direction, index)}
                stroke={isActive ? '#22C55E' : '#84CC16'}
                strokeWidth="28"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />

              {/* 하이라이트 (3D 효과) */}
              <Path
                d={getArrowPath(direction, index)}
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  svg: {
    position: 'absolute',
  },
});
