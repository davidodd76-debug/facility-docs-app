import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Search, MessageCircle, Settings, Folder, Building, Wrench, FileImage, Send, Loader, AlertCircle, CheckCircle } from 'lucide-react';

const FacilityDocsApp = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [documents, setDocuments] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const chatEndRef = useRef(null);

  // Simulated document data (in production, this would come from Google Drive)
  const sampleDocuments = [
    {
      id: '1',
      name: 'HVAC O&M Manual - Building A',
      type: 'O&M Manual',
      facility: 'Building A',
      system: 'HVAC',
      uploadDate: '2024-01-15',
      size: '2.4 MB',
      content: 'This manual covers the operation and maintenance of the HVAC system including air handling units, chillers, boilers, and control systems. Regular maintenance schedules include filter changes every 3 months, belt inspections monthly, and annual system calibration.'
    },
    {
      id: '2',
      name: 'Electrical As-Built Drawings - Building B',
      type: 'As-Built Drawing',
      facility: 'Building B',
      system: 'Electrical',
      uploadDate: '2024-01-20',
      size: '5.1 MB',
      content: 'Electrical as-built drawings showing panel locations, circuit routing, emergency power systems, and lighting layouts. Main electrical room located on ground floor with 2000A service entrance.'
    },
    {
      id: '3',
      name: 'Fire Safety Technical Data',
      type: 'Technical Data',
      facility: 'Building A',
      system: 'Fire Safety',
      uploadDate: '2024-01-10',
      size: '1.8 MB',
      content: 'Fire safety system technical specifications including sprinkler system pressure requirements, alarm panel programming, and emergency evacuation procedures. System tested quarterly.'
    }
  ];

  useEffect(() => {
    setDocuments(sampleDocuments);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    setUploadStatus('Uploading files to Google Drive...');
    
    // Simulate file upload to Google Drive
    setTimeout(() => {
      const newDocs = files.map((file, index) => ({
        id: Date.now() + index,
        name: file.name,
        type: file.name.includes('manual') ? 'O&M Manual' : 
              file.name.includes('drawing') ? 'As-Built Drawing' : 'Technical Data',
        facility: 'New Facility',
        system: 'General',
        uploadDate: new Date().toISOString().split('T')[0],
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        content: `Content extracted from ${file.name}`
      }));
      
      setDocuments(prev => [...prev, ...newDocs]);
      setUploadStatus('Files uploaded successfully!');
      setTimeout(() => setUploadStatus(''), 3000);
    }, 2000);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !apiKey) return;

    const userMessage = { role: 'user', content: chatInput, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsLoading(true);

    try {
      // Find relevant documents based on the question
      const relevantDocs = documents.filter(doc => 
        doc.content.toLowerCase().includes(chatInput.toLowerCase()) ||
        doc.name.toLowerCase().includes(chatInput.toLowerCase()) ||
        doc.system.toLowerCase().includes(chatInput.toLowerCase())
      );

      // Prepare context from relevant documents
      let context = "Based on the facility documentation, here are the relevant documents:\n\n";
      relevantDocs.forEach(doc => {
        context += `Document: ${doc.name}\nType: ${doc.type}\nFacility: ${doc.facility}\nSystem: ${doc.system}\nContent: ${doc.content}\n\n`;
      });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey
        },
        body: JSON.stringify({
          model: "claude-3-sonnet-20240229",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You are a facility management assistant. Answer the following question based on the provided facility documentation. If the information isn't in the documents, say so clearly.

Context from facility documents:
${context}

Question: ${chatInput}

Please provide a helpful answer and cite which specific documents you're referencing.`
            }
          ]
        })
      });

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.content[0].text,
        timestamp: new Date(),
        sources: relevantDocs.map(doc => doc.name)
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling Claude API:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please check your API key and try again.',
        timestamp: new Date(),
        error: true
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.facility.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.system.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSystemIcon = (system) => {
    switch (system.toLowerCase()) {
      case 'hvac': return <Wrench className="w-4 h-4" />;
      case 'electrical': return <FileImage className="w-4 h-4" />;
      case 'fire safety': return <AlertCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'O&M Manual': return 'bg-blue-100 text-blue-800';
      case 'Technical Data': return 'bg-green-100 text-green-800';
      case 'As-Built Drawing': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Building className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Facility Documentation Manager</h1>
            </div>
            <nav className="flex space-x-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'dashboard' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('documents')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'documents' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Documents
              </button>
              <button
                onClick={() => setCurrentView('chat')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'chat' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                AI Assistant
              </button>
              <button
                onClick={() => setCurrentView('settings')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'settings' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Settings className="w-4 h-4" />
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Documents</p>
                    <p className="text-2xl font-semibold text-gray-900">{documents.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <Building className="w-8 h-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Facilities</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {new Set(documents.map(d => d.facility)).size}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <MessageCircle className="w-8 h-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Chat Messages</p>
                    <p className="text-2xl font-semibold text-gray-900">{chatMessages.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Upload */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Upload</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <label className="cursor-pointer">
                  <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Click to upload files
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">PDF files only</p>
                {uploadStatus && (
                  <p className="text-sm text-green-600 mt-2 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {uploadStatus}
                  </p>
                )}
              </div>
            </div>

            {/* Recent Documents */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Documents</h2>
              <div className="space-y-3">
                {documents.slice(0, 5).map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getSystemIcon(doc.system)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.facility} • {doc.system}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(doc.type)}`}>
                      {doc.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Documents View */}
        {currentView === 'documents' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Document Library</h2>
              <div className="flex space-x-4">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocuments.map(doc => (
                <div key={doc.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      {getSystemIcon(doc.system)}
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(doc.type)}`}>
                        {doc.type}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{doc.name}</h3>
                  <div className="text-sm text-gray-600 space-y-1 mb-4">
                    <p><span className="font-medium">Facility:</span> {doc.facility}</p>
                    <p><span className="font-medium">System:</span> {doc.system}</p>
                    <p><span className="font-medium">Size:</span> {doc.size}</p>
                    <p><span className="font-medium">Uploaded:</span> {doc.uploadDate}</p>
                  </div>
                  <button
                    onClick={() => setSelectedDocument(doc)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Document
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat View */}
        {currentView === 'chat' && (
          <div className="bg-white rounded-lg shadow h-96 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-medium text-gray-900">AI Document Assistant</h2>
              <p className="text-sm text-gray-600">Ask questions about your facility documentation</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Start a conversation by asking about your facility documents</p>
                  <p className="text-sm mt-2">Try: "What's the HVAC maintenance schedule?" or "Where is the main electrical panel?"</p>
                </div>
              )}
              
              {chatMessages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : message.error 
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-gray-100 text-gray-900'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-600">Sources:</p>
                        {message.sources.map((source, i) => (
                          <p key={i} className="text-xs text-gray-600">• {source}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-lg">
                    <Loader className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-4 border-t">
              {!apiKey && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">Please set your Claude API key in Settings to use the AI assistant.</p>
                </div>
              )}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask about your facility documents..."
                  disabled={!apiKey || isLoading}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!apiKey || isLoading || !chatInput.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings View */}
        {currentView === 'settings' && (
          <div className="bg-white p-6 rounded-lg shadow max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                  Claude API Key
                </label>
                <input
                  type="password"
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Claude API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your API key is stored locally and never sent to any server except Anthropic's API.
                </p>
              </div>
              
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Google Drive Integration</h3>
                <p className="text-sm text-gray-600 mb-4">
                  This prototype uses simulated Google Drive integration. In production, you would:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• Set up Google Drive API credentials</li>
                  <li>• Configure OAuth 2.0 authentication</li>
                  <li>• Enable automatic PDF text extraction</li>
                  <li>• Set up organized folder structures</li>
                </ul>
              </div>
              
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Deployment Guide</h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p><strong>1. Copy this code to a new GitHub repository</strong></p>
                  <p><strong>2. Connect to Vercel or Netlify for free hosting</strong></p>
                  <p><strong>3. Add environment variables:</strong></p>
                  <ul className="ml-4 space-y-1">
                    <li>• REACT_APP_CLAUDE_API_KEY (your Claude API key)</li>
                    <li>• REACT_APP_GOOGLE_CLIENT_ID (Google Drive API)</li>
                  </ul>
                  <p><strong>4. Deploy and start using your facility docs system!</strong></p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Document Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedDocument.name}</h3>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    <span>{selectedDocument.facility}</span>
                    <span>•</span>
                    <span>{selectedDocument.system}</span>
                    <span>•</span>
                    <span>{selectedDocument.size}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50 mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Document Preview</h4>
                <p className="text-sm text-gray-700">{selectedDocument.content}</p>
              </div>
              
              <div className="flex space-x-3">
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Download PDF
                </button>
                <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
                  Open in Google Drive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilityDocsApp;
