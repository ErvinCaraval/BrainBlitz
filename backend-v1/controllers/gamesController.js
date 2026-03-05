const { db } = require('../firebase');

// List all public games with 'waiting' statu
exports.listPublicGames = async (req, res) => {
  try {
    const snapshot = await db.collection('games')
      .where('isPublic', '==', true)
      .where('status', '==', 'waiting')
      .get();
    const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(games);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a public game by its creator
exports.deletePublicGame = async (req, res) => {
  const { gameId } = req.params;
  // Firebase token decoded: req.user.uid
  const userId = req.user && (req.user.uid || req.user.id);

  try {
    const gameRef = db.collection('games').doc(gameId);
    const gameDoc = await gameRef.get();

    if (!gameDoc.exists) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const gameData = gameDoc.data();
    // El campo puede ser hostId o createdBy según cómo se creó la partida
    const creatorId = gameData.createdBy || gameData.hostId;
    if (!creatorId || creatorId !== userId) {
      return res.status(403).json({ error: 'You are not authorized to delete this game' });
    }

    await gameRef.delete();
    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};