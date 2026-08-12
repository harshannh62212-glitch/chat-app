import React, { useState, useEffect } from 'react';

function MinecraftPage({ user, onBack }) {
  const serverIp = 'atoms-fools.tun.ply.gg';
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState({ online: false, players: { online: 0, max: 20 }, version: '1.21.11', loading: true });

  const [balanceInfo, setBalanceInfo] = useState({ balance: null, loading: false, found: false, username: '' });
  const [searchUsername, setSearchUsername] = useState('');
  const [searching, setSearching] = useState(false);
  const [boundUsernameInput, setBoundUsernameInput] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);

  const fetchBalance = async (usernameToFetch = '') => {
    setSearching(true);
    try {
      const url = usernameToFetch 
        ? `/api/users/minecraft/balance?username=${encodeURIComponent(usernameToFetch)}`
        : `/api/users/minecraft/balance`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setBalanceInfo({
          balance: data.balance,
          loading: false,
          found: data.found,
          username: data.username
        });
        if (!usernameToFetch) {
          setBoundUsernameInput(data.username);
        }
      } else {
        setBalanceInfo(prev => ({ ...prev, loading: false, found: false }));
      }
    } catch (err) {
      console.error('Failed to fetch Minecraft balance:', err);
      setBalanceInfo(prev => ({ ...prev, loading: false, found: false }));
    } finally {
      setSearching(false);
    }
  };

  const handleLinkUsername = async () => {
    setIsLinking(true);
    try {
      const res = await fetch('/api/users/minecraft/username', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('chat_token')}`
        },
        body: JSON.stringify({ minecraftUsername: boundUsernameInput })
      });
      if (res.ok) {
        setShowLinkInput(false);
        fetchBalance();
      }
    } catch (err) {
      console.error('Failed to link Minecraft username:', err);
    } finally {
      setIsLinking(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBalance();
    }
  }, [user]);


  useEffect(() => {
    const fetchServerStatus = async () => {
      try {
        const res = await fetch(`https://api.mcsrvstat.us/3/${serverIp}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.online) {
            setStatus({
              online: true,
              players: {
                online: data.players?.online || 0,
                max: data.players?.max || 20
              },
              version: data.version || '1.21.11',
              loading: false
            });
          } else {
            setStatus(prev => ({ ...prev, online: false, loading: false }));
          }
        } else {
          setStatus(prev => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.error('Failed to fetch Minecraft server status:', err);
        setStatus(prev => ({ ...prev, loading: false }));
      }
    };

    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(serverIp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #14161d 0%, #0b0c10 100%)',
      color: '#fff',
      fontFamily: "'Outfit', sans-serif",
      padding: '40px 20px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background ambient light */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(56, 176, 0, 0.08) 0%, rgba(0,0,0,0) 70%)',
        top: '-150px',
        left: '-150px',
        zIndex: 0,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(56, 176, 0, 0.05) 0%, rgba(0,0,0,0) 70%)',
        bottom: '-150px',
        right: '-150px',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Header Navigation */}
      <div style={{
        width: '100%',
        maxWidth: '800px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '40px',
        zIndex: 10
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '10px 20px',
            borderRadius: '12px',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9em',
            transition: 'all 0.2s ease',
            fontFamily: "'Outfit', sans-serif"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.transform = 'translateX(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          ← Back to Wired
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: status.loading ? '#f1c40f' : (status.online ? '#2ecc71' : '#e74c3c'),
            boxShadow: status.loading ? '0 0 10px #f1c40f' : (status.online ? '0 0 12px #2ecc71' : '0 0 10px #e74c3c'),
            transition: 'all 0.3s ease'
          }} />
          <span style={{ fontSize: '0.9em', fontWeight: '600', color: '#a4b0be', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {status.loading ? 'Checking status...' : (status.online ? 'Server Online' : 'Server Offline')}
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="mc-card" style={{
        width: '100%',
        maxWidth: '700px',
        background: 'rgba(255, 255, 255, 0.01)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '32px',
        padding: '50px 40px',
        boxSizing: 'border-box',
        textAlign: 'center',
        zIndex: 10,
        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Minecraft themed graphic / Title */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{
            fontSize: '4.5em',
            marginBottom: '15px',
            filter: 'drop-shadow(0 10px 15px rgba(56, 176, 0, 0.3))'
          }}>
            🌳
          </div>
          <h1 style={{
            fontSize: '2.5em',
            margin: '0 0 10px 0',
            fontWeight: '900',
            background: 'linear-gradient(90deg, #38b000 0%, #70e000 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px'
          }}>
            WIRED MINECRAFT
          </h1>
          <p style={{
            color: '#7f8c8d',
            margin: '0 auto',
            maxWidth: '450px',
            lineHeight: '1.6',
            fontSize: '1.05em'
          }}>
            Welcome to the official Wired community server. Join us in building and exploring together.
          </p>
        </div>

        {/* Dynamic Server Info Pill */}
        {status.online && !status.loading && (
          <div style={{
            background: 'rgba(56, 176, 0, 0.08)',
            border: '1px solid rgba(56, 176, 0, 0.15)',
            borderRadius: '20px',
            padding: '12px 24px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '15px',
            marginBottom: '35px',
            transition: 'transform 0.2s ease'
          }}>
            <span style={{ fontSize: '0.9em', color: '#70e000', fontWeight: '700' }}>
              👥 {status.players.online} / {status.players.max} Online
            </span>
            <div style={{ width: '1px', height: '15px', background: 'rgba(56, 176, 0, 0.3)' }} />
            <span style={{ fontSize: '0.9em', color: '#70e000', fontWeight: '700' }}>
              💻 Version {status.version}
            </span>
          </div>
        )}

        {/* Balance Display & Search */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(56, 176, 0, 0.05) 0%, rgba(0, 0, 0, 0.4) 100%)',
          border: '1px solid rgba(56, 176, 0, 0.15)',
          borderRadius: '24px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '30px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          <h3 style={{
            fontSize: '1.2em',
            fontWeight: '800',
            color: '#70e000',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            💰 IN-GAME ECONOMY
          </h3>
          
          {user ? (
            <div style={{ width: '100%' }}>
              {showLinkInput ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', margin: '15px 0' }}>
                  <span style={{ fontSize: '0.85em', color: '#a4b0be', fontWeight: '600' }}>Link Minecraft Username</span>
                  <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '320px' }}>
                    <input
                      type="text"
                      placeholder="Minecraft Username"
                      value={boundUsernameInput}
                      onChange={(e) => setBoundUsernameInput(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(56, 176, 0, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#fff',
                        fontSize: '0.9em',
                        outline: 'none',
                        fontFamily: "'Outfit', sans-serif"
                      }}
                    />
                    <button
                      onClick={handleLinkUsername}
                      disabled={isLinking}
                      style={{
                        background: '#38b000',
                        color: '#000',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontSize: '0.9em',
                        fontFamily: "'Outfit', sans-serif"
                      }}
                    >
                      {isLinking ? 'Saving...' : 'Link'}
                    </button>
                    <button
                      onClick={() => setShowLinkInput(false)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '0.9em',
                        fontFamily: "'Outfit', sans-serif"
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {balanceInfo.found ? (
                    <div style={{
                      fontSize: '1.8em',
                      fontWeight: 'bold',
                      color: '#fff',
                      margin: '10px 0',
                      textShadow: '0 2px 10px rgba(112, 224, 0, 0.3)'
                    }}>
                      <span style={{ color: '#a4b0be', fontSize: '0.6em', display: 'block', fontWeight: 'normal', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '5px' }}>
                        Balance for {balanceInfo.username}
                        <button 
                          onClick={() => { setShowLinkInput(true); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#70e000',
                            cursor: 'pointer',
                            fontSize: '1em',
                            marginLeft: '8px',
                            padding: 0,
                            verticalAlign: 'middle'
                          }}
                          title="Change linked account"
                        >
                          ✏️
                        </button>
                      </span>
                      ${balanceInfo.balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  ) : (
                    <div style={{ color: '#7f8c8d', margin: '15px 0', fontSize: '0.95em' }}>
                      No Minecraft account found matching username: <strong>{balanceInfo.username || user.username}</strong>
                      <button 
                        onClick={() => setShowLinkInput(true)}
                        style={{
                          display: 'block',
                          margin: '10px auto 0 auto',
                          background: 'rgba(56, 176, 0, 0.1)',
                          border: '1px solid rgba(56, 176, 0, 0.3)',
                          color: '#70e000',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontFamily: "'Outfit', sans-serif",
                          fontWeight: '600',
                          fontSize: '0.85em'
                        }}
                      >
                        Link different username
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#7f8c8d', fontSize: '0.95em' }}>
              Log in to view your Minecraft balance automatically.
            </div>
          )}

          {/* Search other players */}
          <div style={{
            width: '100%',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            paddingTop: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <span style={{ fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left' }}>
              🔍 Check Player Balance
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Minecraft Username"
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: '0.95em',
                  outline: 'none',
                  fontFamily: "'Outfit', sans-serif"
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchBalance(searchUsername);
                }}
              />
              <button
                onClick={() => fetchBalance(searchUsername)}
                disabled={searching}
                style={{
                  background: '#38b000',
                  color: '#000',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                {searching ? 'Checking...' : 'Check'}
              </button>
            </div>
          </div>
        </div>

        {/* Server Address Box */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '15px',
          marginBottom: '40px'
        }}>
          <span style={{
            fontSize: '0.8em',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            color: '#7f8c8d',
            fontWeight: '700'
          }}>
            Server IP Address
          </span>
          <div style={{
            fontSize: '1.5em',
            fontFamily: "'Courier New', Courier, monospace",
            fontWeight: 'bold',
            color: '#38b000',
            wordBreak: 'break-all',
            background: 'rgba(0,0,0,0.3)',
            padding: '12px 20px',
            borderRadius: '12px',
            border: '1px solid rgba(56,176,0,0.2)'
          }}>
            {serverIp}
          </div>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? '#38b000' : 'rgba(255, 255, 255, 0.05)',
              border: copied ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              padding: '12px 30px',
              borderRadius: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: "'Outfit', sans-serif",
              fontSize: '0.95em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!copied) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              if (!copied) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            {copied ? 'Copied to Clipboard! ✓' : '📋 Copy IP Address'}
          </button>
        </div>

        {/* How to Join Instructions */}
        <div style={{ textAlign: 'left' }}>
          <h3 style={{
            fontSize: '1.2em',
            fontWeight: '800',
            marginBottom: '20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            paddingBottom: '8px',
            color: '#a4b0be'
          }}>
            How to Connect
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{
                background: '#38b000',
                color: '#000',
                fontWeight: '900',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                1
              </div>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Launch Minecraft Java Edition</strong>
                <span style={{ color: '#7f8c8d', fontSize: '0.95em' }}>
                  Open the Minecraft launcher on your PC and run **Java Edition** (Version **1.21.11** is recommended).
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{
                background: '#38b000',
                color: '#000',
                fontWeight: '900',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                2
              </div>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Navigate to Multiplayer</strong>
                <span style={{ color: '#7f8c8d', fontSize: '0.95em' }}>
                  Click on **Multiplayer** from the main menu, then select **Add Server**.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{
                background: '#38b000',
                color: '#000',
                fontWeight: '900',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                3
              </div>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Paste Address & Join</strong>
                <span style={{ color: '#7f8c8d', fontSize: '0.95em' }}>
                  Paste the copied address (`{serverIp}`) into the **Server Address** field and click **Done** to connect.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edition Warning Banner */}
        <div style={{
          marginTop: '40px',
          background: 'rgba(255, 71, 87, 0.06)',
          border: '1px solid rgba(255, 71, 87, 0.15)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'left'
        }}>
          <span style={{ fontSize: '1.4em' }}>⚠️</span>
          <span style={{ color: '#ff6b81', fontSize: '0.9em', lineHeight: '1.5', fontWeight: '500' }}>
            This server is **Java Edition only** and does not support Bedrock (Console/Mobile) players at this time. Please make sure you are connecting from a PC.
          </span>
        </div>

      </div>
    </div>
  );
}

export default MinecraftPage;
