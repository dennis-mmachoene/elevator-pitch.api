# Elevator Pitch - API Documentation

Complete REST API documentation for the Elevator Pitch campus marketplace backend.

## Base URL
```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

Access tokens expire after 15 minutes. Use the refresh token to get a new access token.

---

## Authentication Endpoints

### Register User
**POST** `/auth/register`

Register a new user account.

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@university.edu",
  "password": "SecurePass123",
  "university": "University of XYZ",
  "campus": "Main Campus"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": { /* user object */ },
    "accessToken": "eyJhbGc..."
  }
}
```

### Login User
**POST** `/auth/login`

Login with email and password.

**Body:**
```json
{
  "email": "john@university.edu",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { /* user object */ },
    "accessToken": "eyJhbGc..."
  }
}
```

### Refresh Token
**POST** `/auth/refresh`

Get a new access token using refresh token.

**Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGc..."
  }
}
```

### Get Current User
**GET** `/auth/me` 

Get currently authenticated user's profile.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@university.edu",
      "avatar": "https://...",
      "university": "University of XYZ",
      "campus": "Main Campus",
      "rating": { "average": 4.5, "count": 10 }
    }
  }
}
```

### Update Password
**PUT** `/auth/password` 

Change user password.

**Body:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

### Logout
**POST** `/auth/logout` 

Logout and invalidate refresh token.

---

## User Endpoints

### Get User by ID
**GET** `/users/:id`

Get public user profile.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "avatar": "https://...",
      "rating": { "average": 4.5, "count": 10 },
      "listings": [ /* listing objects */ ]
    }
  }
}
```

### Update Profile
**PUT** `/users/me` 

Update current user's profile.

**Body:**
```json
{
  "name": "John Smith",
  "phone": "+1234567890",
  "bio": "Computer Science student selling textbooks"
}
```

### Get User's Listings
**GET** `/users/:id/listings`

Get all listings by a user.

**Query Parameters:**
- `status` (optional): Filter by status (active, sold, reserved, inactive)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

### Get Saved Listings
**GET** `/users/me/saved` 

Get user's saved/bookmarked listings.

### Save/Unsave Listing
**POST** `/users/me/saved/:listingId` 

Toggle save status for a listing.

### Get User Statistics
**GET** `/users/:id/stats`

Get user's statistics (sales, purchases, ratings).

### Search Users
**GET** `/users/search`

Search for users.

**Query Parameters:**
- `q`: Search query (required)
- `university` (optional): Filter by university
- `campus` (optional): Filter by campus

---

## Listing Endpoints

### Get All Listings
**GET** `/listings`

Get all listings with filters.

**Query Parameters:**
- `category` (optional): textbooks, notes, electronics, gadgets, furniture, other
- `condition` (optional): new, like-new, good, fair, poor
- `minPrice` (optional): Minimum price
- `maxPrice` (optional): Maximum price
- `university` (optional): Filter by university
- `campus` (optional): Filter by campus
- `status` (optional): active, sold, reserved, inactive (default: active)
- `sort` (optional): Sort field (default: -createdAt)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "listings": [ /* array of listings */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

### Search Listings
**GET** `/listings/search`

Full-text search for listings.

**Query Parameters:**
- `q`: Search query (required, min 2 chars)
- `category` (optional)
- `minPrice` (optional)
- `maxPrice` (optional)
- `university` (optional)
- `campus` (optional)

### Get Listing by ID
**GET** `/listings/:id`

Get single listing details.

### Create Listing
**POST** `/listings` 

Create a new listing.

**Body:**
```json
{
  "title": "Introduction to Algorithms - 3rd Edition",
  "description": "Like-new condition, barely used. Includes all chapters.",
  "category": "textbooks",
  "condition": "like-new",
  "price": 45.00,
  "originalPrice": 80.00,
  "images": [
    { "url": "https://...", "publicId": "..." }
  ],
  "location": {
    "university": "University of XYZ",
    "campus": "Main Campus",
    "building": "Library"
  },
  "tags": ["algorithms", "computer-science", "cormen"],
  "isNegotiable": true,
  "bookDetails": {
    "isbn": "978-0262033848",
    "author": "Cormen, Leiserson, Rivest, Stein",
    "edition": "3rd",
    "publisher": "MIT Press"
  }
}
```

### Update Listing
**PUT** `/listings/:id` 

Update existing listing (owner only).

### Delete Listing
**DELETE** `/listings/:id` 

Delete listing (owner only).

### Mark as Sold
**PATCH** `/listings/:id/sold` 

Mark listing as sold (owner only).

### Reactivate Listing
**PATCH** `/listings/:id/reactivate` 

Reactivate sold/inactive listing (owner only).

### Get Featured Listings
**GET** `/listings/featured`

Get featured listings.

### Get Listings by Category
**GET** `/listings/category/:category`

Get all listings in a specific category.

### Get Similar Listings
**GET** `/listings/:id/similar`

Get similar listings based on category and price.

---

## Chat Endpoints

All chat endpoints require authentication.

### Get User's Chats
**GET** `/chat` 

Get all conversations for the current user.

### Create or Get Chat
**POST** `/chat` 

Create a new chat or get existing chat for a listing.

**Body:**
```json
{
  "listingId": "listing_id",
  "sellerId": "seller_user_id"
}
```

### Get Chat by ID
**GET** `/chat/:id` 

Get single chat with all messages.

### Send Message
**POST** `/chat/:id/messages` 

Send a message in a chat.

**Body:**
```json
{
  "content": "Is this still available?",
  "type": "text"
}
```

For image messages:
```json
{
  "content": "Here's what I meant",
  "type": "image",
  "image": {
    "url": "https://...",
    "publicId": "..."
  }
}
```

For price offers:
```json
{
  "content": "Would you accept $40?",
  "type": "offer",
  "offer": {
    "amount": 40
  }
}
```

### Mark Chat as Read
**PUT** `/chat/:id/read` 

Mark all unread messages as read.

### Delete Chat
**DELETE** `/chat/:id` 

Delete/hide chat.

### Block/Unblock Chat
**PUT** `/chat/:id/block` 

Block or unblock a chat.

### Respond to Offer
**PUT** `/chat/:chatId/messages/:messageId/offer` 

Accept or reject a price offer (seller only).

**Body:**
```json
{
  "status": "accepted"  // or "rejected"
}
```

### Get Unread Count
**GET** `/chat/unread/count` 

Get total unread message count.

---

## Order Endpoints

All order endpoints require authentication.

### Create Order
**POST** `/orders` 

Create a new order for a listing.

**Body:**
```json
{
  "listingId": "listing_id",
  "finalPrice": 45.00,
  "negotiatedPrice": 40.00,
  "meetupDetails": {
    "location": "Main Library, 2nd Floor",
    "date": "2024-11-15T14:00:00Z",
    "time": "2:00 PM",
    "additionalInfo": "Near the coffee shop"
  },
  "notes": "Please bring the book in good condition"
}
```

### Get Order by ID
**GET** `/orders/:id` 

Get single order details.

### Get User's Orders
**GET** `/orders` 

Get all orders for the current user.

**Query Parameters:**
- `role`: buyer or seller (default: buyer)
- `status` (optional): Filter by status
- `page` (optional): Page number
- `limit` (optional): Items per page

### Update Order Status
**PUT** `/orders/:id/status` 

Update order status.

**Body:**
```json
{
  "status": "confirmed",
  "note": "Confirmed the order"
}
```

**Status Flow:**
- pending → confirmed/cancelled
- confirmed → meetup-scheduled/cancelled
- meetup-scheduled → in-progress/cancelled
- in-progress → completed/disputed
- disputed → completed/cancelled

### Update Meetup Details
**PUT** `/orders/:id/meetup` 

Update meetup location and time.

### Add Rating
**POST** `/orders/:id/rating` 

Rate the other party after order completion.

**Body:**
```json
{
  "score": 5,
  "review": "Great seller! Item was exactly as described."
}
```

### Cancel Order
**POST** `/orders/:id/cancel` 

Cancel an order.

**Body:**
```json
{
  "reason": "Found a better deal elsewhere"
}
```

### Initiate Dispute
**POST** `/orders/:id/dispute` 

Initiate a dispute for an order.

**Body:**
```json
{
  "reason": "Item not as described"
}
```

### Add Notes
**PUT** `/orders/:id/notes` 

Add private notes to an order.

---

## Upload Endpoints

All upload endpoints require authentication.

### Upload Single Image
**POST** `/upload/image` 

Upload a single image.

**Body (multipart/form-data):**
- `image`: Image file (max 5MB, JPEG/PNG/WebP)

**Response (200):**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "image": {
      "url": "https://res.cloudinary.com/...",
      "publicId": "elevator-pitch/..."
    }
  }
}
```

### Upload Multiple Images
**POST** `/upload/images` 

Upload multiple images (max 10).

**Body (multipart/form-data):**
- `images`: Array of image files

### Upload Avatar
**POST** `/upload/avatar` 

Upload user avatar (replaces existing).

**Body (multipart/form-data):**
- `avatar`: Image file

### Delete Image
**DELETE** `/upload/image`

Delete image from Cloudinary.

**Body:**
```json
{
  "publicId": "elevator-pitch/listings/..."
}
```

---

## Real-time Events (Socket.IO)

The API supports real-time communication via Socket.IO.

### Client Connection
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: accessToken
  }
});
```

### Events to Emit

**Join User Room:**
```javascript
socket.emit('join', userId);
```

**Join Chat Room:**
```javascript
socket.emit('join-chat', chatId);
```

**Typing Indicator:**
```javascript
socket.emit('typing', { chatId, userId });
socket.emit('stop-typing', { chatId, userId });
```

### Events to Listen

**New Message:**
```javascript
socket.on('new-message', (data) => {
  console.log('New message:', data.message);
});
```

**New Order:**
```javascript
socket.on('new-order', (data) => {
  console.log('New order:', data.order);
});
```

**Order Status Update:**
```javascript
socket.on('order-status-update', (data) => {
  console.log('Order status:', data.status);
});
```

**Offer Response:**
```javascript
socket.on('offer-response', (data) => {
  console.log('Offer response:', data.status);
});
```

**User Typing:**
```javascript
socket.on('user-typing', (data) => {
  console.log('User typing:', data.userId);
});
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [  // Optional, for validation errors
    {
      "field": "email",
      "message": "Please provide a valid email"
    }
  ]
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (not allowed)
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

---

## Rate Limiting

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes
- **Create Listing**: 10 requests per hour
- **Send Message**: 20 requests per minute
- **Upload**: 50 requests per hour
- **Search**: 30 requests per minute

---

## Testing with cURL

### Register a User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@university.edu",
    "password": "SecurePass123",
    "university": "University of XYZ",
    "campus": "Main Campus"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@university.edu",
    "password": "SecurePass123"
  }'
```

### Get Listings (Authenticated)
```bash
curl -X GET http://localhost:5000/api/listings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Notes

- All timestamps are in ISO 8601 format
- Prices are in the local currency (no currency field needed)
- Image URLs are served via Cloudinary CDN
- Pagination defaults: page=1, limit=20
- All IDs are MongoDB ObjectIds (24-character hex strings)

= Requires Authentication