# Blue Spoke

**Blue Spoke** is a modern, service-first Point of Sale (POS) and management system designed specifically for bike shops. 

## Key Features

### Service-First Workflows
- **Work Orders**: Create, track, and manage service tickets with a "Rich List" interface.
- **Staging**: Add parts and labor to tickets with real-time inventory search.
- **Status Tracking**: Visual status pipelines (Open, In Progress, Awaiting Parts, Finished).
- **Tech Assignment**: Assign specific technicians to tickets.

### Asset Management
- **Customer Bikes**: Track bikes as distinct assets with Brand, Model, Serial Number, and Color.
- **Service History**: View past work orders for any specific bike.

### Warranty Management
- **Active Tracking**: Dedicated tab for tracking active warranties.
- **Templates**: Quickly register warranties using predefined templates (e.g., "Frame Lifetime", "1 Year Tune-up").
- **Status Chips**: Instantly see if a warranty is Active, Expired, or Void.

### Customer Relationship
- **Rich Profiles**: Store contact info, bike details, and active warranties in one place.
- **Quick Search**: Find customers by name, email, or phone instantly.

### Inventory Control
- **Real-time Search**: Fast search for parts and services.
- **Stock Levels**: Visual indicators for low stock.
- **Service Catalog**: Manage labor codes and pricing.

### Integrated Time Clock
- **Seamless Clock-In**: Built-in sidebar widget for employees to clock in/out.
- **PIN Security**: Secure 4-digit PIN entry via a custom modal.
- **Roster**: See who is currently on shift at a glance.

## Technology Stack

### Backend
- **PHP 8.1+**: Core logic.
- **PostgreSQL**: Relational database for robust data integrity.
- **PDO**: Raw SQL interaction for performance and control.
- **JWT**: Stateless authentication using `firebase/php-jwt`.
- **Phinx**: Database migration management.

### Frontend
- **Vanilla JavaScript (ES Modules)**: Lightweight, fast, and no build step required.
- **Vanilla CSS**: Modern CSS variables, Flexbox, and Grid for a responsive, custom design.
- **Single Page Application (SPA)**: Instant navigation without page reloads.

## Setup & Installation

1.  **Prerequisites**: Ensure you have PHP 8.1+ and PostgreSQL installed.
2.  **Install Dependencies**:
    ```bash
    composer install
    ```
3.  **Database Setup**:
    - Create a PostgreSQL database (e.g., `blue_spoke`).
    - Configure your environment variables (copy `.env.example` to `.env`).
    - Run migrations:
        ```bash
        vendor/bin/phinx migrate
        ```
4.  **Start Server**:
    ```bash
    composer start
    ```
    The app will be available at `http://127.0.0.1:8080`.

## License
Proprietary. Built for Blue Spoke.
