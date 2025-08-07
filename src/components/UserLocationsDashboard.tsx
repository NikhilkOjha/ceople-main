import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, MapPin, Users, RefreshCw, TrendingUp } from 'lucide-react';

interface UserLocationStats {
  totalLocations: number;
  uniqueCountries: number;
  topCountries: Array<{ country: string; count: number }>;
  countryStats: Record<string, number>;
}

const UserLocationsDashboard: React.FC = () => {
  const [stats, setStats] = useState<UserLocationStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/user-locations/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching user location stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getCountryFlag = (countryCode: string) => {
    // Convert country name to ISO code (simplified)
    const countryMap: Record<string, string> = {
      'United States': 'US',
      'Canada': 'CA',
      'United Kingdom': 'GB',
      'Germany': 'DE',
      'France': 'FR',
      'Spain': 'ES',
      'Italy': 'IT',
      'Netherlands': 'NL',
      'Australia': 'AU',
      'Japan': 'JP',
      'India': 'IN',
      'Brazil': 'BR',
      'Mexico': 'MX',
      'Argentina': 'AR',
      'South Africa': 'ZA',
      'Nigeria': 'NG',
      'Egypt': 'EG',
      'Kenya': 'KE',
      'Morocco': 'MA',
      'Ghana': 'GH'
    };
    
    const code = countryMap[countryCode] || countryCode.substring(0, 2).toUpperCase();
    return `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">🌍 User Locations</h2>
        <Button onClick={fetchStats} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLocations}</div>
            <p className="text-xs text-muted-foreground">
              Location records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Countries</CardTitle>
            <Globe className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.uniqueCountries}</div>
            <p className="text-xs text-muted-foreground">
              Countries represented
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Reach</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.uniqueCountries > 0 ? ((stats.uniqueCountries / 195) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Of world countries
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Countries by Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.topCountries.map((item, index) => (
              <div key={item.country} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-muted-foreground w-6">#{index + 1}</span>
                    <img 
                      src={getCountryFlag(item.country)} 
                      alt={item.country}
                      className="w-6 h-4 rounded object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span className="text-sm font-medium">{item.country}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{item.count}</span>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${(item.count / stats.totalLocations) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Geographic Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">North America</span>
                <span className="text-sm font-medium">
                  {Object.entries(stats.countryStats)
                    .filter(([country]) => 
                      ['United States', 'Canada', 'Mexico'].includes(country)
                    )
                    .reduce((sum, [, count]) => sum + count, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Europe</span>
                <span className="text-sm font-medium">
                  {Object.entries(stats.countryStats)
                    .filter(([country]) => 
                      ['United Kingdom', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands'].includes(country)
                    )
                    .reduce((sum, [, count]) => sum + count, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Asia</span>
                <span className="text-sm font-medium">
                  {Object.entries(stats.countryStats)
                    .filter(([country]) => 
                      ['Japan', 'India', 'China', 'South Korea'].includes(country)
                    )
                    .reduce((sum, [, count]) => sum + count, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Other Regions</span>
                <span className="text-sm font-medium">
                  {stats.totalLocations - Object.entries(stats.countryStats)
                    .filter(([country]) => 
                      ['United States', 'Canada', 'Mexico', 'United Kingdom', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Japan', 'India', 'China', 'South Korea'].includes(country)
                    )
                    .reduce((sum, [, count]) => sum + count, 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Most Popular Country</span>
                <span className="text-sm font-medium">
                  {stats.topCountries[0]?.country || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Avg Users per Country</span>
                <span className="text-sm font-medium">
                  {stats.uniqueCountries > 0 ? (stats.totalLocations / stats.uniqueCountries).toFixed(1) : 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Countries with 10+ Users</span>
                <span className="text-sm font-medium">
                  {Object.values(stats.countryStats).filter(count => count >= 10).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserLocationsDashboard;
