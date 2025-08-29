import React from 'react';

interface ServiceNowIconProps {
  width?: number;
  height?: number;
  className?: string;
}

const ServiceNowIcon: React.FC<ServiceNowIconProps> = ({
  width = 24,
  height = 24,
  className = ''
}) => {
  return (
    <img
      src="/src/assets/connectors/service now logo.svg"
      alt="ServiceNow Logo"
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

export default ServiceNowIcon;
