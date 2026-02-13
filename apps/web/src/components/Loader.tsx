import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullScreen?: boolean;
  label?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 'md', className = '', fullScreen = false, label }) => {
  const sizeClass = `loader-${size}`;
  
  const content = (
    <div className={`loader-wrapper ${className}`}>
      <div className={`loader ${sizeClass}`}></div>
      {label && <p className="loader-label">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loader-container full-screen">
        {content}
      </div>
    );
  }

  return (
    <div className="loader-container">
      {content}
    </div>
  );
};
