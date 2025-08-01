import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';
import { Rocket, Moon, Sun, Users, Globe, MessageCircle, Video, Shield, Smile } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Simple dark mode hook
function useDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);
  return [isDark, setIsDark] as const;
}

const testimonials = [
  {
    text: 'I made a new friend in 10 seconds. Amazing!',
    author: 'Aaryan, India',
  },
  {
    text: 'Love the instant chat. No sign-ups, just vibes.',
    author: 'Leila, UK',
  },
  {
    text: 'The video chat is so smooth, even on my phone.',
    author: 'Carlos, Brazil',
  },
  {
    text: 'I met someone from another continent. Super cool!',
    author: 'Mia, Australia',
  },
  {
    text: 'The design is beautiful and it just works.',
    author: 'Jonas, Germany',
  },
  {
    text: 'I use it every day to meet new people.',
    author: 'Sara, USA',
  },
  {
    text: 'No spam, no weird stuff, just real people.',
    author: 'Priya, India',
  },
  {
    text: 'The waitlist was worth it. Love the experience!',
    author: 'Omar, Egypt',
  },
];

const features = [
  {
    icon: Users,
    title: 'Anonymous Chat',
    desc: 'No account needed. Jump into a conversation instantly.'
  },
  {
    icon: Globe,
    title: 'Global Community',
    desc: 'Meet people from every corner of the world in seconds.'
  },
  {
    icon: Video,
    title: 'Video & Text Chat',
    desc: 'Switch between face-to-face and text-only chats freely.'
  },
  {
    icon: Shield,
    title: 'Safe & Secure',
    desc: 'Your privacy is protected with end-to-end encryption.'
  },
  {
    icon: MessageCircle,
    title: 'Real-Time Messaging',
    desc: 'Lightning-fast chat with instant delivery.'
  },
  {
    icon: Smile,
    title: 'Fun & Friendly',
    desc: 'Meet new people and enjoy positive vibes.'
  },
];

export default function LandingPage() {
  const [isDark, setIsDark] = useDarkMode();
  // Fake live stats
  const [online, setOnline] = useState(1238);
  useEffect(() => {
    // Animate the number up/down a bit for realism
    const interval = setInterval(() => {
      setOnline(n => n + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3));
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  // Email form state
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle'|'success'|'error'>('idle');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailStatus('idle');
    if (!email) return;
    // Insert into Supabase
    const { error } = await supabase.from('waitlist_emails').insert([{ email }]);
    if (error) {
      setEmailStatus('error');
    } else {
      setEmailStatus('success');
      setEmail('');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
        style={{ minHeight: '100vh' }}
      >
        <source src="/landing-bg.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/70 z-10 transition-colors duration-500" />
      {/* Theme Toggle */}
      <button
        className="fixed top-4 right-4 z-30 bg-white/20 dark:bg-black/40 rounded-full p-2 shadow-lg hover:scale-110 transition"
        onClick={() => setIsDark(d => !d)}
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="w-6 h-6 text-yellow-300" /> : <Moon className="w-6 h-6 text-gray-800" />}
      </button>
      {/* Content */}
      <div className="relative z-20 min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-900/60 via-black/60 to-gray-800/60 text-white px-2 sm:px-6 py-8 sm:py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-16"
        >
          <TypeAnimation
            sequence={['Welcome to Skiploby', 2000, 'Meet New Friends Instantly', 2000, 'No Sign-Up, Just Chat!', 2000]}
            wrapper="h1"
            className="text-4xl sm:text-5xl font-bold mb-4"
            repeat={Infinity}
          />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="bg-white/10 px-4 py-2 rounded-full text-lg font-medium flex items-center gap-2 shadow"
            >
              <Users className="w-5 h-5 text-green-400" />
              <span>{online.toLocaleString()} people online now</span>
            </motion.div>
            <Link to="/auth">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full text-lg font-semibold shadow transition"
              >
                Start Chatting <Rocket className="w-5 h-5 ml-1" />
              </motion.button>
            </Link>
          </div>
        </motion.div>
        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl mx-auto mb-10 sm:mb-16"
        >
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-stretch">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white/10 rounded-xl p-5 shadow flex-1 flex flex-col justify-between">
                <p className="text-lg italic mb-2">“{t.text}”</p>
                <span className="text-xs text-gray-300">– {t.author}</span>
              </div>
            ))}
          </div>
        </motion.div>
        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-10 sm:mb-16"
        >
          {features.map((f, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.05 }}
              className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-lg flex flex-col items-center text-center"
            >
              <f.icon className="w-10 h-10 mb-3 text-blue-400" />
              <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-300">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
        {/* Email Capture Form */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="max-w-lg mx-auto bg-white/10 rounded-xl p-6 shadow-lg mb-8"
        >
          <h3 className="text-2xl font-bold mb-2">Join the Waitlist</h3>
          <p className="text-sm text-gray-300 mb-4">Get early access and updates. No spam, ever.</p>
          <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              placeholder="Your email"
              className="flex-1 px-4 py-2 rounded bg-white/80 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailStatus('idle'); }}
              disabled={emailStatus === 'success'}
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold transition"
              disabled={emailStatus === 'success'}
            >
              {emailStatus === 'success' ? 'Thank you!' : 'Notify Me'}
            </button>
          </form>
          {emailStatus === 'success' && (
            <p className="text-green-400 mt-2 text-sm">You’re on the list! 🎉</p>
          )}
          {emailStatus === 'error' && (
            <p className="text-red-400 mt-2 text-sm">Something went wrong. Please try again.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}