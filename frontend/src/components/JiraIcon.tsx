import React from 'react';

interface JiraIconProps {
  width?: number;
  height?: number;
  className?: string;
}

const JiraIcon: React.FC<JiraIconProps> = ({
  width = 24,
  height = 24,
  className = ''
}) => {
  return (
    <img
      src="/src/assets/connectors/Jira_Logo.svg"
      alt="Jira Logo"
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

export default JiraIcon;
