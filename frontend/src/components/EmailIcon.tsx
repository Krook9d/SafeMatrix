import React from 'react';

interface EmailIconProps {
  width?: number;
  height?: number;
  className?: string;
}

const EmailIcon: React.FC<EmailIconProps> = ({
  width = 24,
  height = 24,
  className = ''
}) => {
  return (
    <img
      src="/src/assets/connectors/logo_email.svg"
      alt="Email Logo"
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

export default EmailIcon;
