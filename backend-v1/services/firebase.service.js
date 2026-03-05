/**
 * Firebase service (NOTE)
 * Historically this file stored face images and embeddings in Firestore.
 * Face persistence has been moved to `facial-service` + Redis.
 * Keep this file minimal to avoid accidental writes of face data.
 */
class FirebaseFaceService {
  // Placeholder: face storage moved to microservice (Redis). If you need
  // user-related Firestore operations, add them here explicitly (but avoid
  // storing faceImage/faceEmbedding fields).
}

module.exports = new FirebaseFaceService();

