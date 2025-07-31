import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Search, MessageCircle, Settings, Folder, Building, Wrench, FileImage, Send, Loader, AlertCircle, CheckCircle, Cloud, Key } from 'lucide-react';

const FacilityDocsApp = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [documents, setDocuments] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('claudeApiKey') || '');
  const [googleClientId, setGoogleClientId] = useState(localStorage.getItem('googleClientId') || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);
  const chatEndRef = useRef(null);

  // Initialize Google API
  useEffect(() => {
    if (googleClientId) {
      loadGoogleAPI();
    }
  }, [googleClientId]);

  const loadGoogleAPI = () => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = initializeGapi;
    document.body.appendChild(script);
  };

  const initializeGapi = () => {
    window.gapi.load('auth2:client:picker', initClient);
  };

  const initClient = () => {
    window.gapi.client.init({
      clientId: googleClientId,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly'
    }).then(() => {
      const authInstance = window.gapi.auth2.getAuthInstance();
      setIsGoogleSignedIn(authInstance.isSignedIn.get());
      
      if (authInstance.isSignedIn.get()) {
        setGoogleUser(authInstance.currentUser.get().getBasicProfile());
        loadDocumentsFromDrive();
      }

      authInstance.isSignedIn.listen(setIsGoogleSignedIn);
    });
  };

  const signInToGoogle = () => {
    const authInstance = window.gapi.auth2.getAuthInstance();
    authInstance.signIn().then(() => {
      setGoogleUser(authInstance.currentUser.get().getBasicProfile());
      loadDocumentsFromDrive();
    });
  };

  const signOutFromGoogle = () => {
    const authInstance = window.gapi.auth2.getAuthInstance();
    authInstance.signOut().then(() => {
      setGoogleUser(null);
      setDocuments([]);
    });
  };

  const loadDocumentsFromDrive = async () => {
    try {
      setUploadStatus('Loading documents from Google Drive...');
      
      const response = await window.gapi.client.drive.files.list({
        q: "mimeType='application/pdf' and not trashed",
        fields: 'files(id,name,size,createdTime,modifiedTime,parents,webViewLink)',
        orderBy: 'modifiedTime desc'
      });

      const files = response.result.files;
      const driveDocuments = files.map(file => ({
        id: file.id,
        name: file.name,
        type: categorizeDocument(file.name),
        facility: extractFacilityFromName(file.name),
        system: extractSystemFromName(file.name),
        uploadDate: new Date(file.createdTime).toISOString().split('T')[0],
        size: file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Unknown',
        webViewLink: file.webViewLink,
        content: ''
      }));

      setDocuments(driveDocuments);
      setUploadStatus(`Loaded ${driveDocuments.length} documents from Google Drive`);
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (error) {
      console.error('Error loading documents:', error);
      setUploadStatus('Error loading documents from Google Drive');
    }
  };

  const categorizeDocument = (filename) => {
    const lower = filename.toLowerCase();
    if (lower.includes('manual') || lower.includes('o&m') || lower.includes('om')) return 'O&M Manual';
    if (lower.includes('drawing') || lower.includes('blueprint') || lower.includes('asbuilt')) return 'As-Built Drawing';
    if (lower.includes('technical') || lower.includes('spec') || lower.includes('data')) return 'Technical Data';
    return 'General Document';
  };

  const extractFacilityFromName = (filename) => {
    const matches = filename.match(/building\s*([a-z0-9]+)/i);
    if (matches) return `Building ${matches[1].toUpperCase()}`;
    
    const floorMatches = filename.match(/floor\s*(\d+)/i);
    if (floorMatches) return `Floor ${floorMatches[1]}`;
    
    return 'General Facility';
  };

  const extractSystemFromName = (filename) => {
    const lower = filename.toLowerCase();
    if (lower.includes('hvac') || lower.includes('heating') || lower.includes('cooling')) return 'HVAC';
    if (lower.includes('electrical') || lower.includes('electric') || lower.includes('power')) return 'Electrical';
    if (lower.includes('fire') || lower.includes('safety') || lower.includes('alarm')) return 'Fire Safety';
    if (lower.includes('plumbing') || lower.includes('water') || lower.includes('pipe')) return 'Plumbing';
    if (lower.includes('security') || lower.includes('access')) return 'Security';
    return 'General';
  };

  const uploadToDrive = async (files) => {
    if (!isGoogleSignedIn) {
      setUploadStatus('Please sign in to Google Drive first');
      return;
    }

    setUploadStatus('Uploading files to Google Drive...');
    
    try {
      const facilityFolderId = await createFacilityFolder();
      
      for (const file of files) {
        const metadata = {
          name: file.name,
          parents: [facilityFolderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
        form.append('file', file);

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: new Headers({
            'Authorization': `Bearer ${window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
          }),
          body: form
        });
      }

      setUploadStatus(`Successfully uploaded ${files.length} files to Google Drive`);
      loadDocumentsFromDrive();
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Error uploading files to Google Drive');
    }
  };

  const createFacilityFolder = async () => {
    try {
      const existingFolders = await window.gapi.client.drive.files.list({
        q: "name='Facility Documents' and mimeType='application/vnd.google-apps.folder' and not trashed"
      });

      if (existingFolders.result.files.length > 0) {
        return existingFolders.result.files[0].id;
      }

      const folderMetadata = {
        name: 'Facility Documents',
        mimeType: 'application/vnd.google-apps.folder'
      };

      const folder = await window.gapi.client.drive.files.create({
        resource: folderMetadata
      });

      return folder.result.id;
    } catch (error) {
      console.error('Error creating folder:', error);
      return null;
    }
  };

  const extractTextFromPDF = async (fileId) => {
    try {
      return `Content extracted from document ${fileId}. This would contain the actual PDF text in a production system.`;
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      return 'Unable to extract text from this document.';
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    await uploadToDrive(files);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !apiKey) return;

    const userMessage = { role: 'user', content: chatInput, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    const currentInput = chatInput;
    setChatInput('');
    setIsLoading(true);

    try {
      const relevantDocs = documents.filter(doc => 
        doc.name.toLowerCase().includes(currentInput.toLowerCase()) ||
        doc.system.toLowerCase().includes(currentInput.toLowerCase()) ||
        doc.facility.toLowerCase().includes(currentInput.toLowerCase())
      );

      let context = "Based on the facility documentation in Google Drive:\n\n";
      for (const doc of relevantDocs) {
        if (!doc.content) {
          doc.content = await extractTextFromPDF(doc.id);
        }
        context += `Document: ${doc.name}\nType: ${doc.type}\nFacility: ${doc.facility}\nSystem: ${doc.system}\nContent: ${doc.content}\n\n`;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You are a facility management assistant with access to facility documentation stored in Google Drive. Answer the following question based on the provided facility documentation. If the information isn't in the documents, say so clearly and suggest what type of document might contain that information.

Context from facility documents:
${context}

Question: ${currentInput}

Please provide a helpful answer and cite which specific documents you're referencing. If you need additional information, suggest what type of document or system documentation would be helpful.`
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

  const saveSettings = () => {
    localStorage.setItem('claudeApiKey', apiKey);
    localStorage.setItem('googleClientId', googleClientId);
    setUploadStatus('Settings saved successfully!');
    setTimeout(() => setUploadStatus(''), 3000);
    
    if (googleClientId && !window.gapi) {
      loadGoogleAPI();
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
            <div className="flex items-center space-x-4">
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
              
              {/* Google Drive Status */}
              <div className="flex items-center space-x-2">
                {isGoogleSignedIn ? (
                  <div className="flex items-center space-x-2">
                    <Cloud className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600">Drive Connected</span>
                    <button
                      onClick={signOutFromGoogle}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={signInToGoogle}
                    disabled={!googleClientId}
                    className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    <Cloud className="w-4 h-4" />
                    <span>Connect Drive</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Configuration Alert */}
        {(!apiKey || !googleClientId) && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
              <div>
                <p className="text-sm text-yellow-800">
                  <strong>Setup Required:</strong> Please configure your API keys in Settings to enable all features.
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  You need both Claude API key and Google Client ID for full functionality.
                </p>
              </div>
            </div>
          </div>
        )}

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
              <h2 className="text-lg font-medium text-gray-900 mb-4">Upload to Google Drive</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                {isGoogleSignedIn ? (
                  <label className="cursor-pointer">
                    <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                      Click to upload PDF files to Google Drive
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <p className="text-sm text-gray-500">Connect to Google Drive to upload files</p>
                )}
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
              {documents.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  {isGoogleSignedIn ? 'No PDF documents found in Google Drive' : 'Connect to Google Drive to see your documents'}
                </p>
              ) : (
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
              )}
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
                {isGoogleSignedIn && (
                  <button
                    onClick={loadDocumentsFromDrive}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                  >
                    <Cloud className="w-4 h-4" />
                    <span>Refresh</span>
                  </button>
                )}
              </div>
            </div>

            {filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {isGoogleSignedIn ? 'No documents found' : 'Connect to Google Drive to see your documents'}
                </p>
              </div>
            ) : (
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
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedDocument(doc)}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        View Details
                      </button>
                      {doc.webViewLink && (
                        <a
                          href={doc.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Open in Drive
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat View */}
        {currentView === 'chat' && (
          <div className="space-y-4">
            {/* AI Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-amber-800">Important Disclaimer</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    AI responses are generated based on available documentation and may contain errors or omissions. 
                    Always verify critical information with original documents or qualified professionals before making 
                    operational decisions. This tool is designed to assist with information retrieval, not replace 
                    professional judgment or official procedures.
                  </p>
                </div>
              </div>
            </div>

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
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Always verify AI responses with original documents before taking action
                </p>
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
                <div className="flex space-x-2">
                  <input
                    type="password"
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Claude API key (sk-ant-...)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Key className="w-5 h-5 text-gray-400 mt-2.5" />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Get your API key from console.anthropic.com
                </p>
              </div>
              
              <div>
                <label htmlFor="googleClientId" className="block text-sm font-medium text-gray-700 mb-2">
                  Google Client ID
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="googleClientId"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="Enter your Google Client ID (ends with .googleusercontent.com)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Cloud className="w-5 h-5 text-gray-400 mt-2.5" />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Get from Google Cloud Console → APIs & Services → Credentials
                </p>
              </div>
              
              <button
                onClick={saveSettings}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Settings
              </button>
              
              {uploadStatus && (
                <p className="text-sm text-green-600 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {uploadStatus}
                </p>
              )}
              
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Setup Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    {apiKey ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm ${apiKey ? 'text-green-600' : 'text-red-600'}`}>
                      Claude API Key {apiKey ? 'Configured' : 'Missing'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {googleClientId ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm ${googleClientId ? 'text-green-600' : 'text-red-600'}`}>
                      Google Client ID {googleClientId ? 'Configured' : 'Missing'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isGoogleSignedIn ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                    )}
                    <span className={`text-sm ${isGoogleSignedIn ? 'text-green-600' : 'text-orange-600'}`}>
                      Google Drive {isGoogleSignedIn ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Google Drive Setup Guide</h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p><strong>1. Go to Google Cloud Console</strong></p>
                  <p className="ml-4">Visit console.cloud.google.com and create a new project</p>
                  
                  <p><strong>2. Enable APIs</strong></p>
                  <p className="ml-4">Enable "Google Drive API" and "Google Picker API"</p>
                  
                  <p><strong>3. Create Credentials</strong></p>
                  <p className="ml-4">Create OAuth 2.0 Client ID for web application</p>
                  <p className="ml-4">Add your domain: https://facility-docs-54w0qzqk2-daves-projects-b85627a2.vercel.app</p>
                  
                  <p><strong>4. Copy Client ID</strong></p>
                  <p className="ml-4">Paste the Client ID (ends with .googleusercontent.com) above</p>
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
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50 mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Document Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Type:</span> {selectedDocument.type}
                  </div>
                  <div>
                    <span className="font-medium">Facility:</span> {selectedDocument.facility}
                  </div>
                  <div>
                    <span className="font-medium">System:</span> {selectedDocument.system}
                  </div>
                  <div>
                    <span className="font-medium">Upload Date:</span> {selectedDocument.uploadDate}
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                {selectedDocument.webViewLink && (
                  <a
                    href={selectedDocument.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                  >
                    <Cloud className="w-4 h-4" />
                    <span>Open in Google Drive</span>
                  </a>
                )}
                <button 
                  onClick={() => setSelectedDocument(null)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Close
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
                    
