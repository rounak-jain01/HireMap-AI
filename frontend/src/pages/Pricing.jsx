import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiZap, FiArrowRight } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export default function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(null);

  // Load Razorpay SDK Script
  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscription = async (plan) => {
    if (plan.id === 'free') return;
    
    setLoading(plan.id);
    const isLoaded = await loadRazorpay();

    if (!isLoaded) {
      alert("Razorpay SDK failed to load. Please check your internet connection.");
      setLoading(null);
      return;
    }

    const RAZOR_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID;
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

    try {
      // 1. Backend se Order ID generate karwana
      const orderRes = await fetch(`${BACKEND_URL}/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: plan.price * 100 }) // Convert INR to Paisa
      });
      
      const orderData = await orderRes.json();
      
      if (orderData.status !== "success") {
        throw new Error(orderData.message || "Failed to create order");
      }

      // 2. Razorpay Checkout Options setup
      const options = {
        key: RAZOR_KEY,
        amount: orderData.order.amount,
        currency: "INR",
        name: "HireMap AI",
        description: `Upgrade to ${plan.name} Plan`,
        image: "https://your-logo-url.com/logo.png", // Optional: Tumhara logo
        order_id: orderData.order.id,
        handler: async (response) => {
          // 3. Payment verify karwana backend par
          try {
            const verifyRes = await fetch(`${BACKEND_URL}/verify-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: user?.email,
                tier: plan.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyData.status === "success") {
              alert(`🎉 Success! You are now a ${plan.name} member.`);
              window.location.reload(); // Refresh to update UI states
            } else {
              alert("Payment verification failed: " + verifyData.message);
            }
          } catch (err) {
            console.error("Verification Error:", err);
          }
        },
        prefill: {
          name: user?.displayName || "User",
          email: user?.email || ""
        },
        theme: { color: "#6366f1" }, // Indigo-500
        modal: {
            ondismiss: () => setLoading(null)
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();

    } catch (error) {
      console.error("Subscription Error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      id: 'free',
      name: 'Learner',
      price: '0',
      description: 'Ideal for beginners starting their journey.',
      features: ['3 Job Matches / day', '1 AI Mock Interview', 'Standard Career Roadmap', 'Community Support'],
      buttonText: 'Current Plan',
      isPro: false,
      color: 'from-slate-700 to-slate-800'
    },
    {
      id: 'pro',
      name: 'Career Hunter',
      price: '499',
      description: 'Accelerate your job search with AI power.',
      features: ['Unlimited Job Matches', '10 Mock Interviews / mo', 'Priority AI Counselor', 'ATS Resume Export', 'Daily Market Insights'],
      buttonText: 'Upgrade to Pro',
      isPro: true,
      popular: true,
      color: 'from-indigo-600 to-purple-600'
    },
    {
      id: 'elite',
      name: 'Job Winner',
      price: '999',
      description: 'Total dominance with unlimited access.',
      features: ['Everything in Pro', 'Unlimited Mock Interviews', '1-on-1 AI Mentorship', 'Direct Referral Access', 'Premium Portfolio Templates'],
      buttonText: 'Go Elite',
      isPro: true,
      color: 'from-amber-500 to-orange-600'
    }
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
      <div className="text-center mb-16">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-white via-indigo-300 to-slate-500 bg-clip-text text-transparent"
        >
          Supercharge Your Career
        </motion.h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Choose the plan that fits your ambition. Get the tools you need to land your dream job faster.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ y: -10 }}
            className={`relative bg-[#121214] border rounded-3xl p-8 flex flex-col h-full transition-all duration-300 ${
              plan.popular ? 'border-indigo-500 shadow-[0_0_40px_rgba(79,70,229,0.15)] scale-105 z-10' : 'border-white/5'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest">
                Most Popular
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
              <p className="text-slate-500 text-sm">{plan.description}</p>
            </div>

            <div className="mb-8 flex items-baseline gap-1">
              <span className="text-4xl font-black text-white">₹{plan.price}</span>
              <span className="text-slate-500 font-medium">/month</span>
            </div>

            <div className="space-y-4 mb-10 flex-1">
              {plan.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`mt-1 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${plan.isPro ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700/30 text-slate-500'}`}>
                    <FiCheck size={12} />
                  </div>
                  <span className="text-sm text-slate-300 leading-tight">{feature}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleSubscription(plan)}
              disabled={(plan.id === 'free') || loading}
              className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                plan.id === 'free' 
                  ? 'bg-slate-800 text-slate-500 cursor-default'
                  : `bg-gradient-to-r ${plan.color} text-white shadow-lg hover:shadow-indigo-500/20 active:scale-95`
              }`}
            >
              {loading === plan.id ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {plan.buttonText} {plan.id !== 'free' && <FiArrowRight />}
                </>
              )}
            </button>
          </motion.div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
          <FiZap className="text-indigo-500" /> Secure payment processing via Razorpay
        </p>
      </div>
    </div>
  );
}