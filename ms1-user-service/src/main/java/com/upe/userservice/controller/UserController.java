package com.upe.userservice.controller;

import com.upe.userservice.dto.CreateUserRequest;
import com.upe.userservice.dto.UserEvent;
import com.upe.userservice.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody CreateUserRequest request) {
        log.info("[USER-SERVICE] POST /api/users recibido");

        try {
            UserEvent event = userService.createUser(request);

            // Respuesta enriquecida para que el frontend pueda mostrar el correlationId
            Map<String, String> response = Map.of(
                "userId",        event.getPayload().getUserId(),
                "nombre",        event.getPayload().getNombre(),
                "apellido",      event.getPayload().getApellido(),
                "email",         event.getPayload().getEmail(),
                "eventId",       event.getEventId(),
                "correlationId", event.getCorrelationId(),
                "message",       "Usuario creado y evento propagado exitosamente"
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (UserService.EmailAlreadyExistsException e) {
            log.warn("[USER-SERVICE] Conflicto: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("[USER-SERVICE] Error inesperado: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error interno del servidor"));
        }
    }
}
