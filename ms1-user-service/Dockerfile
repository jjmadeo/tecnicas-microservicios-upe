# Stage 1: Build con Maven
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
# Descarga dependencias primero (caching de layers)
COPY pom.xml .
RUN mvn dependency:go-offline -q
# Compila el proyecto
COPY src/ ./src/
RUN mvn package -DskipTests -q

# Stage 2: Runtime solo con JRE
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
