import React from 'react';

interface TheHiveIconProps {
  width?: number;
  height?: number;
  className?: string;
}

const TheHiveIcon: React.FC<TheHiveIconProps> = ({
  width = 24,
  height = 24,
  className = ''
}) => {
  return (
    <img
      src="/src/assets/connectors/TheHive_icon.svg"
      alt="TheHive Logo"
      width={width}
      height={height}
      className={className}
      style={{
        objectFit: 'contain',
        display: 'block'
      }}
    />
  );
};

export default TheHiveIcon;
