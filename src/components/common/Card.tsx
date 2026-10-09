import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hoverable = false }) => {
  return (
    <div
      className={`bg-graphite border border-graphite-surface/80 rounded-2xl p-5 shadow-xl transition-all duration-200 ${
        hoverable ? 'hover:border-mint/30 hover:shadow-mint/5 hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
