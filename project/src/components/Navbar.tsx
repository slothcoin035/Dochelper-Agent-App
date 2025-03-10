import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from './ui/Button';
import { FileText, Settings, BookTemplate as Templates, Moon, Sun, FolderOpen } from 'lucide-react';

const Navbar = () => {
  const { user, signOut } = useAuthStore();
  const [darkMode, setDarkMode] = React.useState(false);
  const location = useLocation();

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-xl">DocHelper AI</span>
          </Link>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link to="/documents">
                  <Button 
                    variant={location.pathname === '/documents' ? 'default' : 'ghost'} 
                    size="sm"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Documents
                  </Button>
                </Link>
                <Link to="/templates">
                  <Button 
                    variant={location.pathname === '/templates' ? 'default' : 'ghost'} 
                    size="sm"
                  >
                    <Templates className="h-4 w-4 mr-2" />
                    Templates
                  </Button>
                </Link>
                <Link to="/settings">
                  <Button 
                    variant={location.pathname === '/settings' ? 'default' : 'ghost'} 
                    size="sm"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={() => signOut()}>
                  Sign Out
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button size="sm">Sign In</Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;