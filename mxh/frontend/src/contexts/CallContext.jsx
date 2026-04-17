import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { on, send } from '../services/websocket';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const CALL_TIMEOUT_MS = 30000;

// call state: 'idle' | 'calling_out' | 'ringing_in' | 'connected'
const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { user } = useAuth();

  const [callState, setCallState] = useState('idle');
  // peer = { userId, username, avatar }
  const [peer, setPeer] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);          // RTCPeerConnection
  const localStreamRef = useRef(null); // MediaStream (mic)
  const timeoutRef = useRef(null);     // 30s ring timeout
  const durationRef = useRef(null);    // call timer interval
  const pendingOfferRef = useRef(null);// SDP offer held while ringing

  // ── helpers ──────────────────────────────────────────────────────────────

  const clearRingTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const stopDurationTimer = () => {
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
  };

  const startDurationTimer = () => {
    setCallDuration(0);
    durationRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
  };

  const closePeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  const reset = useCallback(() => {
    clearRingTimeout();
    stopDurationTimer();
    stopLocalStream();
    closePeerConnection();
    pendingOfferRef.current = null;
    setCallState('idle');
    setPeer(null);
    setIsMuted(false);
    setCallDuration(0);
  }, []);

  const createPeerConnection = useCallback((toUserId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send('call.ice', { to_user_id: toUserId, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        reset();
      }
    };

    // Remote audio: attach to hidden <audio> element
    pc.ontrack = (e) => {
      let audio = document.getElementById('call-remote-audio');
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'call-remote-audio';
        audio.autoplay = true;
        document.body.appendChild(audio);
      }
      audio.srcObject = e.streams[0];
    };

    return pc;
  }, [reset]);

  // ── Outgoing call ─────────────────────────────────────────────────────────

  const startCall = useCallback(async (targetUser) => {
    if (!user || callState !== 'idle') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPeerConnection(targetUser.id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pcRef.current = pc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setPeer(targetUser);
      setCallState('calling_out');

      send('call.offer', {
        to_user_id: targetUser.id,
        sdp: offer,
        from_username: user.username,
        from_avatar: user.avatar || null,
      });

      // 30s timeout
      timeoutRef.current = setTimeout(() => {
        send('call.end', { to_user_id: targetUser.id });
        reset();
      }, CALL_TIMEOUT_MS);

    } catch (err) {
      console.error('[Call] startCall error:', err);
      reset();
    }
  }, [user, callState, createPeerConnection, reset]);

  // ── Accept incoming call ───────────────────────────────────────────────────

  const acceptCall = useCallback(async () => {
    if (callState !== 'ringing_in' || !peer || !pendingOfferRef.current) return;
    clearRingTimeout();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPeerConnection(peer.userId);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pcRef.current = pc;

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      send('call.answer', { to_user_id: peer.userId, sdp: answer });

      setCallState('connected');
      startDurationTimer();
      pendingOfferRef.current = null;

    } catch (err) {
      console.error('[Call] acceptCall error:', err);
      reset();
    }
  }, [callState, peer, createPeerConnection, reset]);

  // ── Reject incoming call ───────────────────────────────────────────────────

  const rejectCall = useCallback(() => {
    if (callState !== 'ringing_in' || !peer) return;
    send('call.reject', { to_user_id: peer.userId });
    reset();
  }, [callState, peer, reset]);

  // ── End call (either side) ─────────────────────────────────────────────────

  const endCall = useCallback(() => {
    if (!peer) return;
    send('call.end', { to_user_id: peer.userId });
    reset();
  }, [peer, reset]);

  // ── Mute toggle ────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => {
      t.enabled = !t.enabled;
    });
    setIsMuted(prev => !prev);
  }, []);

  // Keep a ref to callState so listeners always see current value without re-subscribing
  const callStateRef = useRef(callState);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // ── WebSocket event listeners ──────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    const unsubs = [
      // Incoming call offer
      on('call.offer', async (data) => {
        if (callStateRef.current !== 'idle') {
          // Already in a call — auto-reject
          send('call.reject', { to_user_id: data.from_user_id });
          return;
        }
        pendingOfferRef.current = data.sdp;
        setPeer({
          userId: data.from_user_id,
          username: data.from_username,
          avatar: data.from_avatar,
        });
        setCallState('ringing_in');

        // 30s auto-reject
        timeoutRef.current = setTimeout(() => {
          send('call.reject', { to_user_id: data.from_user_id });
          reset();
        }, CALL_TIMEOUT_MS);
      }),

      // Callee accepted
      on('call.answer', async (data) => {
        if (!pcRef.current) return;
        clearRingTimeout();
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          setCallState('connected');
          startDurationTimer();
        } catch (err) {
          console.error('[Call] setRemoteDescription error:', err);
          reset();
        }
      }),

      // Callee rejected
      on('call.reject', () => {
        reset();
      }),

      // Either side ended
      on('call.end', () => {
        reset();
      }),

      // ICE candidate exchange
      on('call.ice', async (data) => {
        if (!pcRef.current || !data.candidate) return;
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('[Call] addIceCandidate error:', err);
        }
      }),
    ];

    return () => unsubs.forEach(fn => fn());
  // Subscribe once when user is set — callStateRef handles current value
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <CallContext.Provider value={{
      callState,
      peer,
      isMuted,
      callDuration,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  return useContext(CallContext);
}
