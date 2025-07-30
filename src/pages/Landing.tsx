import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white px-6 py-12">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <h1 className="text-5xl font-bold mb-4">Welcome to Skiploby</h1>
        <p className="text-xl mb-6 max-w-2xl mx-auto">
          Instantly connect with strangers around the world. No sign-up, just chat.
        </p>
        <Link to="/auth">
          <span className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full text-lg transition">
            Start Chatting
          </span>
        </Link>
      </motion.div>

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {[
          {
            title: 'Anonymous Chat',
            description: 'No account needed. Jump into a conversation instantly.'
          },
          {
            title: 'Global Community',
            description: 'Meet people from every corner of the world in seconds.'
          },
          {
            title: 'Video & Text Chat',
            description: 'Switch between face-to-face and text-only chats freely.'
          }
        ].map((feature, idx) => (
          <motion.div
            key={idx}
            whileHover={{ scale: 1.05 }}
            className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-lg"
          >
            <h3 className="text-2xl font-semibold mb-2">{feature.title}</h3>
            <p className="text-sm text-gray-300">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}