import { useState, useRef } from "react";
import jsPDF from "jspdf";

const SYSTEM_PROMPT = `You are a helpful healthcare assistant. Provide brief, clear responses that are:
1. Concise and to the point (2-3 sentences max per topic)
2. Easy to understand
3. Focused on practical advice
4. Include only essential medical information
5. Add a very brief disclaimer only when necessary

Keep total response length under 100 words.`;

// Helper function to format messages with bold text and line breaks
const formatMessage = (text) => {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <div key={i}>
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        })}
      </div>
    );
  });
};

// Function to download response as text file
const downloadResponse = (content) => {
  const doc = new jsPDF();

  // Set font styles
  doc.setFont("helvetica");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 255);
  doc.text("Medical Consultation Report", 20, 20);

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`ID: ${content.reportId}`, 20, 30);
  doc.text(`Timestamp: ${content.timestamp}`, 20, 40);

  doc.setFontSize(12);
  doc.text("Patient Query:", 20, 60);
  // Handle text wrapping for long queries
  const splitQuery = doc.splitTextToSize(content.query, 170);
  doc.text(splitQuery, 20, 70);

  doc.text("Medical Response:", 20, 90);
  // Handle text wrapping for long responses
  const splitResponse = doc.splitTextToSize(content.response, 170);
  doc.text(splitResponse, 20, 100);

  doc.setFontSize(10);
  doc.setTextColor(128);
  const disclaimer =
    "Disclaimer: This is an AI-generated response for informational purposes only. Please consult with a qualified healthcare professional for medical advice.";
  const splitDisclaimer = doc.splitTextToSize(disclaimer, 170);
  doc.text(splitDisclaimer, 20, 250);

  // Save PDF
  doc.save(`medical-report-${content.reportId}.pdf`);
};

const Chatbot = () => {
  const [userMessage, setUserMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const chatContainerRef = useRef(null);

  const API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent";
  const API_KEY = import.meta.env.VITE_API_KEY;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!userMessage.trim()) return;
    if (!API_KEY) {
      setError("API key is not configured");
      return;
    }

    const newUserMessage = {
      type: "user",
      content: userMessage,
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setUserMessage("");
    setIsLoading(true);

    try {
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: `${SYSTEM_PROMPT}\n\nUser: ${userMessage}\n\nAssistant:`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 150,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      };

      const res = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        throw new Error("API request failed");
      }

      const data = await res.json();
      if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
        throw new Error("Invalid API response");
      }

      const botResponse = {
        type: "bot",
        content: {
          query: userMessage,
          response: data.candidates[0].content.parts[0].text.trim(),
          timestamp: new Date().toLocaleString(),
          reportId: Math.random().toString(36).substr(2, 9).toUpperCase(),
        },
      };

      setMessages((prev) => [...prev, botResponse]);

      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      setError("Failed to process your request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Modified version with new UI and color theme
    <div className="flex flex-col h-screen bg-gradient-to-b from-orange-50 to-red-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white py-4 px-6 shadow-lg">
        <h1 className="text-xl md:text-2xl font-bold">Organ Healthcare Partner</h1>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
        <div className="max-w-3xl mx-auto">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center space-y-6 mt-10">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-red-500 to-orange-400 rounded-full flex items-center justify-center shadow-xl">
                <span className="text-4xl md:text-5xl">👨‍⚕️</span>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">
                  Virtual Organ Healthcare Partner Assistant
                </h2>
                <p className="text-gray-600">
                  Describe your symptoms for a detailed health analysis
                </p>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-6 flex ${
                message.type === "user" ? "justify-end" : "justify-start w-full"
              }`}
            >
              {message.type === "user" ? (
                <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl px-6 py-3 max-w-[80%] md:max-w-[70%] shadow-md">
                  {message.content}
                </div>
              ) : (
                <div className="bg-white shadow-xl rounded-2xl w-full max-w-[90%] md:max-w-[85%] overflow-hidden border border-orange-100">
                  {/* Report Header */}
                  <div className="bg-gradient-to-r from-red-100 to-orange-100 px-6 py-4">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white rounded-full">
                          <svg
                            className="w-6 h-6 text-red-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800">
                            Health Analysis Report
                          </h3>
                          <p className="text-sm text-gray-600">
                            ID: {message.content.reportId}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        {message.content.timestamp}
                      </div>
                    </div>
                  </div>

                  {/* Report Content */}
                  <div className="px-6 py-4 space-y-6">
                    {/* Symptoms Section */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-700 flex items-center">
                        <span className="mr-2">🔍</span> Patient Symptoms
                      </h4>
                      <div className="bg-orange-50 p-4 rounded-xl">
                        {message.content.query}
                      </div>
                    </div>

                    {/* Analysis Section */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-700 flex items-center">
                        <span className="mr-2">📋</span> Medical Analysis
                      </h4>
                      <div className="bg-red-50 p-4 rounded-xl">
                        {formatMessage(message.content.response)}
                      </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl">
                      ⚠️ This is an AI-generated analysis for informational
                      purposes only. Please consult with a healthcare
                      professional for medical advice.
                    </div>
                  </div>

                  {/* Report Footer */}
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-t border-orange-100">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-400 to-orange-400 flex items-center justify-center">
                          <span className="text-white text-lg">AI</span>
                        </div>
                        <span className="text-sm text-gray-600">
                          Health Assistant
                        </span>
                      </div>
                      <button
                        onClick={() => downloadResponse(message.content)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full hover:from-red-600 hover:to-orange-600 transition-all duration-300"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        <span>Save Report</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading Animation */}
          {isLoading && (
            <div className="flex justify-center mb-4">
              <div className="bg-white shadow-xl rounded-2xl px-8 py-6 border border-orange-100">
                <div className="flex flex-col items-center space-y-6">
                  {/* Medical Icon Animation */}
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-75"></div>
                    <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-r from-red-500 to-orange-500 rounded-full">
                      <svg
                        className="w-8 h-8 text-white animate-pulse"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Animated Steps */}
                  <div className="flex items-center justify-between w-full max-w-xs">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
                      <span className="text-xs text-gray-500 mt-1">
                        Analyzing
                      </span>
                    </div>
                    <div className="flex-1 h-0.5 bg-gray-200 mx-2">
                      <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 animate-progressBar"></div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div
                        className="w-3 h-3 bg-orange-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <span className="text-xs text-gray-500 mt-1">
                        Processing
                      </span>
                    </div>
                    <div className="flex-1 h-0.5 bg-gray-200 mx-2">
                      <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 animate-progressBar"></div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div
                        className="w-3 h-3 bg-red-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                      <span className="text-xs text-gray-500 mt-1">
                        Preparing
                      </span>
                    </div>
                  </div>

                  {/* Status Message */}
                  <div className="text-center">
                    <p className="text-gray-600 font-medium">
                      Analyzing your health information
                    </p>
                    <p className="text-sm text-gray-500 animate-pulse">
                      Please wait while we process your query...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-red-500 text-center my-4 p-4 bg-red-100 rounded-xl border border-red-200">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-orange-100 p-4 bg-white">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            placeholder="Describe your symptoms..."
            className="flex-1 p-3 border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`px-6 py-3 rounded-xl transition-all duration-300 ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
            }`}
            disabled={isLoading}
          >
            {isLoading ? "Analyzing..." : "Analyze"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chatbot;
