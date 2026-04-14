package com.upe.userservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class UserServiceApplication {
    public static void main(String[] args) {
        System.out.println("[USER-SERVICE] ================================================");
        System.out.println("[USER-SERVICE] Iniciando MS1 - User Service (Java/Spring Boot)");
        System.out.println("[USER-SERVICE] ================================================");
        SpringApplication.run(UserServiceApplication.class, args);
    }
}
