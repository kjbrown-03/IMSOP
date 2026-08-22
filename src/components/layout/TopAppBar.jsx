import { Link } from 'react-router-dom';
import { User, Activity } from 'lucide-react';

import UserProfileDropdown from '../ui/UserProfileDropdown';
import ThemeToggle from '../ui/ThemeToggle';

export default function TopAppBar({ title = 'IMSOP', left, right, avatarUrl }) {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-4 sm:px-6 h-16 glass-card border-b-0 shadow-sm transition-all duration-300">
      {left || (
        <UserProfileDropdown />
      )}
      
      <div className="flex flex-col items-center flex-1">
        <h1 className="font-display text-xl font-bold text-[var(--color-heading)] tracking-tight flex items-center gap-2">
          {title === 'IMSOP' ? (
             <><Activity className="w-5 h-5 text-primary" /> IMSOP</>
          ) : title}
        </h1>
      </div>
      
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {right}
      </div>
    </header>
  )
}
