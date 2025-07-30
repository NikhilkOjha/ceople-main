import { useEffect } from 'react';

const SocialBar = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = '//pl27305594.profitableratecpm.com/ea/1f/a2/ea1fa22a0546b714c77dff02596fe0b0.js';
    script.async = true;
    script.id = 'profitableratecpm-social-bar';
    document.body.appendChild(script);
    return () => {
      const el = document.getElementById('profitableratecpm-social-bar');
      if (el) el.remove();
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        pointerEvents: 'none', // Let the ad script handle its own pointer events
      }}
      aria-hidden="true"
    >
      {/* The ad script will inject its own content here */}
    </div>
  );
};

export default SocialBar;