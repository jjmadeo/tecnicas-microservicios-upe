package com.upe.userservice.dto;

import lombok.Data;

@Data
public class CreateUserRequest {
    private String nombre;
    private String apellido;
    private String email;
    private Integer edad;
}
