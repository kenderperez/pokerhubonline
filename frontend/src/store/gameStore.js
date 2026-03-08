import { create } from 'zustand'

export const useGameStore = create((set, get) => ({
  page:          'lobby',
  setPage:       (p) => set({ page: p }),

  playerName:    '',
  socketId:      null,
  userAddress:   null,
  setPlayerName: (name) => { localStorage.setItem('playerName', name); set({ playerName: name }) },
  setSocketId:   (id)   => set({ socketId: id }),
  setUserAddress:(addr) => set({ userAddress: addr }),

  roomId:    null,
  roomType:  'free',
  isHost:    false,
  setRoom:   ({ roomId, type, isHost }) => set({ roomId, roomType: type || 'free', isHost }),

  gameState:    null,
  myCards:      [],
  myBalance:    0,
  BB_VALUE:     20,
  setGameState: (data) => {
    set({ gameState: data })
    const sid = get().socketId
    const mySeat = data.seats?.find(s => s?.id === sid)
    if (mySeat) {
      if (mySeat.holeCards?.length > 0) set({ myCards: mySeat.holeCards })
      if (mySeat.balance !== undefined) set({ myBalance: mySeat.balance })
    }
    if (data.bigBlind) set({ BB_VALUE: data.bigBlind * 2 })
  },
  setMyCards:   (c) => set({ myCards: c }),
  setMyBalance: (b) => set({ myBalance: b }),

  isMyTurn:  false,
  turnData:  null,
  setTurn:   (data) => set({ isMyTurn: true,  turnData: data }),
  clearTurn: ()     => set({ isMyTurn: false, turnData: null }),

  loading:    false,
  setLoading: (v) => set({ loading: v }),

  logs:   [],
  addLog: (msg) => set(s => ({ logs: [...s.logs.slice(-99), msg] })),

  publicRooms:    [],
  setPublicRooms: (rooms) => set({ publicRooms: rooms }),
}))