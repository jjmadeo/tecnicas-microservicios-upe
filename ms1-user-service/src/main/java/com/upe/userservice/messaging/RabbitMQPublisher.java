package com.upe.userservice.messaging;

import com.upe.userservice.config.RabbitMQConfig;
import com.upe.userservice.dto.UserEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RabbitMQPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishUserCreated(UserEvent event) {
        log.info("[USER-SERVICE] Publicando evento en RabbitMQ...");
        log.info("[USER-SERVICE] Exchange: {} | Routing Key: {}",
                RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY_USER_CREATED);
        log.info("[USER-SERVICE] eventId={} | correlationId={}", event.getEventId(), event.getCorrelationId());

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_NAME,
                RabbitMQConfig.ROUTING_KEY_USER_CREATED,
                event
        );

        log.info("[USER-SERVICE] Evento 'user.created' publicado exitosamente");
        log.info("[USER-SERVICE] Suscriptores notificados: MS2 (Account), MS3 (Notification), MS4 (Audit)");
    }
}
