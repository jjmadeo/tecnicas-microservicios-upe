package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	exchangeName = "microservices.events"
	queueName    = "q.audit.service"
	bindingKey   = "#" // Captura TODOS los eventos (wildcard)
)

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func connectRabbitMQ(url string) (*amqp.Connection, error) {
	for i := 1; i <= 20; i++ {
		conn, err := amqp.Dial(url)
		if err == nil {
			return conn, nil
		}
		log.Printf("[AUDIT-SERVICE] RabbitMQ no disponible (intento %d/20): %v. Reintentando en 5s...", i, err)
		time.Sleep(5 * time.Second)
	}
	return nil, amqp.ErrClosed
}

func connectMongoDB(url string) (*mongo.Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(url))
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}
	return client, nil
}

func handleMessage(ctx context.Context, col *mongo.Collection, d amqp.Delivery) {
	log.Printf("[AUDIT-SERVICE] ================================================")
	log.Printf("[AUDIT-SERVICE] Evento recibido | routing key: %s", d.RoutingKey)

	var event map[string]interface{}
	if err := json.Unmarshal(d.Body, &event); err != nil {
		log.Printf("[AUDIT-SERVICE] Error parseando evento: %v", err)
		d.Nack(false, false)
		return
	}

	eventId, _   := event["eventId"].(string)
	eventType, _ := event["eventType"].(string)
	service, _   := event["service"].(string)

	log.Printf("[AUDIT-SERVICE] eventType=%s | eventId=%s | service=%s", eventType, eventId, service)

	// Agregar timestamp de recepcion
	event["receivedAt"] = time.Now().UTC()

	result, err := col.InsertOne(ctx, event)
	if err != nil {
		log.Printf("[AUDIT-SERVICE] Error guardando en MongoDB: %v", err)
		d.Nack(false, true)
		return
	}

	log.Printf("[AUDIT-SERVICE] Registro de auditoria guardado en MongoDB")
	log.Printf("[AUDIT-SERVICE] _id=%v | eventType=%s | eventId=%s", result.InsertedID, eventType, eventId)
	log.Printf("[AUDIT-SERVICE] ================================================")

	d.Ack(false)
}

func main() {
	log.Println("[AUDIT-SERVICE] ================================================")
	log.Println("[AUDIT-SERVICE] Iniciando MS4 - Audit Service (Go)")
	log.Println("[AUDIT-SERVICE] Captura TODOS los eventos con binding '#'")
	log.Println("[AUDIT-SERVICE] ================================================")

	rabbitURL := getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")
	mongoURL  := getEnv("MONGODB_URL", "mongodb://localhost:27017")
	mongoDB   := getEnv("MONGODB_DB", "ms4_audit_db")

	// Conectar MongoDB
	log.Printf("[AUDIT-SERVICE] Conectando a MongoDB: %s", mongoURL)
	mongoClient, err := connectMongoDB(mongoURL)
	if err != nil {
		log.Fatalf("[AUDIT-SERVICE] Error conectando MongoDB: %v", err)
	}
	defer mongoClient.Disconnect(context.Background())
	log.Println("[AUDIT-SERVICE] Conectado a MongoDB")

	col := mongoClient.Database(mongoDB).Collection("audit_events")

	// Crear indices
	ctx := context.Background()
	col.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "eventType", Value: 1}}},
		{Keys: bson.D{{Key: "timestamp", Value: -1}}},
		{Keys: bson.D{{Key: "receivedAt", Value: -1}}},
	})
	log.Println("[AUDIT-SERVICE] Indices en MongoDB creados")

	// Conectar RabbitMQ
	log.Printf("[AUDIT-SERVICE] Conectando a RabbitMQ: %s", rabbitURL)
	conn, err := connectRabbitMQ(rabbitURL)
	if err != nil {
		log.Fatalf("[AUDIT-SERVICE] Error conectando RabbitMQ: %v", err)
	}
	defer conn.Close()
	log.Println("[AUDIT-SERVICE] Conectado a RabbitMQ")

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("[AUDIT-SERVICE] Error abriendo canal: %v", err)
	}
	defer ch.Close()

	// Declarar exchange
	err = ch.ExchangeDeclare(exchangeName, "topic", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("[AUDIT-SERVICE] Error declarando exchange: %v", err)
	}

	// Declarar cola
	q, err := ch.QueueDeclare(queueName, true, false, false, false, nil)
	if err != nil {
		log.Fatalf("[AUDIT-SERVICE] Error declarando cola: %v", err)
	}

	// Binding con '#' -> captura absolutamente todo
	err = ch.QueueBind(q.Name, bindingKey, exchangeName, false, nil)
	if err != nil {
		log.Fatalf("[AUDIT-SERVICE] Error en binding: %v", err)
	}

	log.Printf("[AUDIT-SERVICE] Cola '%s' con binding '%s' -> captura todos los eventos", queueName, bindingKey)

	msgs, err := ch.Consume(q.Name, "", false, false, false, false, nil)
	if err != nil {
		log.Fatalf("[AUDIT-SERVICE] Error registrando consumer: %v", err)
	}

	ch.Qos(1, 0, false)

	log.Println("[AUDIT-SERVICE] Esperando eventos de auditoria...")

	forever := make(chan struct{})
	go func() {
		for d := range msgs {
			handleMessage(ctx, col, d)
		}
	}()

	<-forever
}
