package com.upe.userservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserEvent {

    private String eventId;
    private String eventType;
    private String timestamp;
    private String service;
    private String correlationId;
    private Payload payload;
    private AuditMetadata audit;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Payload {
        private String userId;
        private String nombre;
        private String apellido;
        private String email;
        private Integer edad;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuditMetadata {
        private String requestId;
        private String sessionId;
        private String ipAddress;
        private String userAgent;
        private String environment;
        private String version;
        private String processedBy;
    }
}
