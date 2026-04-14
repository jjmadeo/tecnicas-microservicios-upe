package com.upe.userservice.service;

import com.upe.userservice.dto.CreateUserRequest;
import com.upe.userservice.dto.UserEvent;
import com.upe.userservice.messaging.RabbitMQPublisher;
import com.upe.userservice.model.User;
import com.upe.userservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Random;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RabbitMQPublisher publisher;
    private final Random random = new Random();

    private static final String[] SAMPLE_USER_AGENTS = {
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        "Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0"
    };

    @Transactional
    public UserEvent createUser(CreateUserRequest request) {
        log.info("[USER-SERVICE] ================================================");
        log.info("[USER-SERVICE] Procesando solicitud de creacion de usuario");
        log.info("[USER-SERVICE] nombre={} apellido={} email={} edad={}",
                request.getNombre(), request.getApellido(), request.getEmail(), request.getEdad());

        // Verificar email duplicado
        if (userRepository.existsByEmail(request.getEmail())) {
            log.warn("[USER-SERVICE] Email ya registrado: {}", request.getEmail());
            throw new EmailAlreadyExistsException("El email ya esta registrado: " + request.getEmail());
        }

        // Guardar usuario en PostgreSQL
        log.info("[USER-SERVICE] Guardando usuario en PostgreSQL...");
        User user = User.builder()
                .nombre(request.getNombre())
                .apellido(request.getApellido())
                .email(request.getEmail())
                .edad(request.getEdad())
                .build();

        user = userRepository.save(user);
        log.info("[USER-SERVICE] Usuario guardado en BD | userId={}", user.getId());

        // Generar metadatos de auditoria (random para fines didacticos)
        String correlationId = UUID.randomUUID().toString();
        String eventId = UUID.randomUUID().toString();
        String requestId = UUID.randomUUID().toString();
        String sessionId = UUID.randomUUID().toString();
        String ipAddress = generateRandomIp();
        String userAgent = SAMPLE_USER_AGENTS[random.nextInt(SAMPLE_USER_AGENTS.length)];

        log.info("[USER-SERVICE] Metadatos de auditoria generados:");
        log.info("[USER-SERVICE]   correlationId={}", correlationId);
        log.info("[USER-SERVICE]   eventId={}", eventId);
        log.info("[USER-SERVICE]   ipAddress={}", ipAddress);

        // Construir evento
        UserEvent event = UserEvent.builder()
                .eventId(eventId)
                .eventType("user.created")
                .timestamp(Instant.now().toString())
                .service("user-service")
                .correlationId(correlationId)
                .payload(UserEvent.Payload.builder()
                        .userId(user.getId().toString())
                        .nombre(user.getNombre())
                        .apellido(user.getApellido())
                        .email(user.getEmail())
                        .edad(user.getEdad())
                        .build())
                .audit(UserEvent.AuditMetadata.builder()
                        .requestId(requestId)
                        .sessionId(sessionId)
                        .ipAddress(ipAddress)
                        .userAgent(userAgent)
                        .environment("development")
                        .version("1.0.0")
                        .processedBy("user-service")
                        .build())
                .build();

        // Publicar evento en RabbitMQ
        publisher.publishUserCreated(event);

        log.info("[USER-SERVICE] Flujo completado para userId={}", user.getId());
        log.info("[USER-SERVICE] ================================================");

        return event;
    }

    private String generateRandomIp() {
        return (10 + random.nextInt(223)) + "." +
               random.nextInt(256) + "." +
               random.nextInt(256) + "." +
               (1 + random.nextInt(254));
    }

    public static class EmailAlreadyExistsException extends RuntimeException {
        public EmailAlreadyExistsException(String message) {
            super(message);
        }
    }
}
